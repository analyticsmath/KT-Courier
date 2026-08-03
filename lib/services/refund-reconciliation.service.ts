import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { RefundError } from "@/lib/refunds/errors";
import { assertRefundOperationId } from "@/lib/refunds/refund-note-policy";
import { assertRefundProductionActivation } from "@/lib/refunds/refund-production-readiness";
import type { ProviderRefundQueryResult, RefundProviderAdapter } from "@/lib/refunds/providers/refund-provider-adapter";
import { validateRefundProviderResult, unknownRefundProviderResult } from "@/lib/refunds/providers/refund-provider-result";
import { RefundProviderRegistry } from "@/lib/refunds/providers/refund-provider-registry";
import * as refundExecution from "./refund-provider-execution.service";

async function callProviderQuery(adapter: RefundProviderAdapter, providerRefundId: string, refundReference: string, timeoutMs: number): Promise<ProviderRefundQueryResult> {
  if (!adapter.queryRefund || !adapter.capabilities.supportsStatusQuery) return Object.freeze({ status: "UNKNOWN", providerStatusCode: "QUERY_UNAVAILABLE", definitive: false });
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); const error = new Error("Refund provider query timed out."); error.name = "AbortError"; reject(error); }, timeoutMs);
  });
  try {
    return await Promise.race([
      adapter.queryRefund({ refundPublicReference: refundReference, providerRefundId }, { signal: controller.signal, correlationId: refundReference, timeoutMs }),
      timeoutPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function queryRefundProviderStatus(input: Readonly<{
  actorUserId: string;
  refundId: string;
  operationId: string;
}>, dependencies: Readonly<{ assertProductionReady?: () => void; registry?: RefundProviderRegistry; timeoutMs?: number }> = {}) {
  (dependencies.assertProductionReady ?? assertRefundProductionActivation)();
  assertRefundOperationId(input.operationId);
  const refund = await prisma.paymentRefund.findUnique({ where: { id: input.refundId }, include: { currentAttempt: true } });
  if (!refund || !refund.currentAttempt || refund.status !== "RECONCILIATION_REQUIRED" || refund.currentAttempt.status !== "UNKNOWN") throw new RefundError("REFUND_INVALID_STATE", "Refund does not have an unknown provider outcome to query.");
  if (refund.customerUserId === input.actorUserId || refund.approvedByUserId === input.actorUserId) throw new RefundError("REFUND_DUAL_CONTROL_REQUIRED", "Requester or approver cannot reconcile and complete this refund.");
  if (refund.currentAttempt.provider !== "PAYFAST" || !refund.currentAttempt.providerRefundId) {
    await prisma.$transaction((tx) => refundExecution.openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: refund.currentAttempt!.id, attemptReference: refund.currentAttempt!.publicReference, reason: "PROVIDER_QUERY_UNAVAILABLE", safeSummary: "Provider query cannot run without a reviewed provider refund reference." }));
    return refund;
  }
  const registry = dependencies.registry ?? new RefundProviderRegistry();
  const adapter = registry.getAdapter("PAYFAST");
  if (!adapter.queryRefund || !adapter.capabilities.supportsStatusQuery) {
    await prisma.$transaction((tx) => refundExecution.openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: refund.currentAttempt!.id, attemptReference: refund.currentAttempt!.publicReference, reason: "PROVIDER_QUERY_UNAVAILABLE", safeSummary: "Provider refund query semantics are unavailable or not reviewed." }));
    return refund;
  }
  let result: ProviderRefundQueryResult;
  try {
    result = validateRefundProviderResult(await callProviderQuery(adapter, refund.currentAttempt.providerRefundId, refund.publicReference, Math.min(Math.max(dependencies.timeoutMs ?? 10_000, 100), 30_000)));
  } catch (error) {
    result = unknownRefundProviderResult(error);
  }
  return refundExecution.finalizeProviderRefundAttempt({ actorUserId: input.actorUserId, refundPublicReference: refund.publicReference, attemptPublicReference: refund.currentAttempt.publicReference, result });
}

export async function scanRefundReconciliation(input: Readonly<{ now?: Date; staleAfterMs?: number }> = {}) {
  const now = input.now ?? new Date();
  const staleBefore = new Date(now.getTime() - (input.staleAfterMs ?? 15 * 60_000));
  const stale = await prisma.refundExecutionAttempt.findMany({ where: { status: "PROCESSING", updatedAt: { lte: staleBefore } }, include: { refund: { select: { id: true, publicReference: true } } } });
  for (const attempt of stale) {
    await prisma.$transaction(async (tx) => {
      await openGenericRefundCase(tx, { refundId: attempt.refund.id, refundReference: attempt.refund.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "STALE_PROCESSING_ATTEMPT", summary: "Refund provider attempt remains processing beyond the reviewed threshold." });
    });
  }
  const payments = await prisma.payment.findMany({
    where: { OR: [{ totalRefundedAmount: { gt: 0 } }, { totalRefundReservedAmount: { gt: 0 } }] },
    include: { refunds: { select: { amount: true, status: true, id: true, publicReference: true } } },
  });
  let projectionMismatches = 0;
  for (const payment of payments) {
    const succeeded = payment.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
    const reserved = payment.refunds.filter((refund) => ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"].includes(refund.status)).reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
    if (!succeeded.equals(payment.totalRefundedAmount) || !reserved.equals(payment.totalRefundReservedAmount) || succeeded.add(reserved).greaterThan(payment.amount)) {
      projectionMismatches += 1;
      const target = payment.refunds[0];
      if (target) await prisma.$transaction((tx) => openGenericRefundCase(tx, { refundId: target.id, refundReference: target.publicReference, reason: "PAYMENT_REFUND_TOTAL_MISMATCH", summary: "Payment refund projections do not match refund aggregate evidence." }));
    }
  }
  const refundEvidence = await prisma.paymentRefund.findMany({
    select: {
      id: true, publicReference: true, amount: true, status: true, method: true,
      reserveLedgerJournal: { select: { type: true, currency: true, entries: { select: { direction: true, amount: true } } } },
      releaseLedgerJournal: { select: { type: true, currency: true, entries: { select: { direction: true, amount: true } } } },
      completionLedgerJournal: { select: { type: true, currency: true, entries: { select: { direction: true, amount: true } } } },
      fundingAllocations: { select: { amount: true, commissionAllocationId: true, commissionAllocation: { select: { amount: true, status: true, downstreamReleaseJournalId: true } } } },
    },
  });
  let ledgerMismatches = 0;
  const commissionTotals = new Map<string, { total: Prisma.Decimal; original: Prisma.Decimal; released: boolean; refundId: string; refundReference: string }>();
  for (const refund of refundEvidence) {
    const fundingTotal = refund.fundingAllocations.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    const reserveCoherent = journalTotalsEqual(refund.reserveLedgerJournal, "REFUND_RESERVE", refund.amount);
    const released = refund.status === "REJECTED" || refund.status === "CANCELLED";
    const succeeded = refund.status === "SUCCEEDED";
    const requiredJournalMissing = !refund.reserveLedgerJournal || (released && !refund.releaseLedgerJournal) || (succeeded && !refund.completionLedgerJournal);
    const linkedJournalIncoherent = !reserveCoherent
      || (released && !journalTotalsEqual(refund.releaseLedgerJournal, "REFUND_RELEASE", refund.amount))
      || (succeeded && !journalTotalsEqual(refund.completionLedgerJournal, refund.method === "CUSTOMER_WALLET" ? "REFUND_WALLET_CREDIT" : "REFUND_EXTERNAL_PAYOUT", refund.amount))
      || !fundingTotal.equals(refund.amount);
    if (requiredJournalMissing || linkedJournalIncoherent) {
      ledgerMismatches += 1;
      await prisma.$transaction((tx) => openGenericRefundCase(tx, {
        refundId: refund.id,
        refundReference: refund.publicReference,
        reason: requiredJournalMissing ? "REFUND_LEDGER_LINK_MISSING" : "REFUND_LEDGER_AMOUNT_MISMATCH",
        summary: requiredJournalMissing ? "Refund state is missing required immutable journal evidence." : "Refund journal or funding amounts do not equal the refund amount.",
      }));
    }
    if (!released) for (const item of refund.fundingAllocations) {
      if (!item.commissionAllocationId || !item.commissionAllocation) continue;
      const existing = commissionTotals.get(item.commissionAllocationId);
      commissionTotals.set(item.commissionAllocationId, {
        total: (existing?.total ?? new Prisma.Decimal(0)).add(item.amount),
        original: item.commissionAllocation.amount,
        released: item.commissionAllocation.status === "RELEASED" || Boolean(item.commissionAllocation.downstreamReleaseJournalId),
        refundId: existing?.refundId ?? refund.id,
        refundReference: existing?.refundReference ?? refund.publicReference,
      });
    }
  }
  let commissionMismatches = 0;
  for (const item of commissionTotals.values()) {
    if (!item.released && !item.total.greaterThan(item.original)) continue;
    commissionMismatches += 1;
    await prisma.$transaction((tx) => openGenericRefundCase(tx, {
      refundId: item.refundId,
      refundReference: item.refundReference,
      reason: item.released ? "DOWNSTREAM_COMMISSION_RELEASE" : "COMMISSION_ADJUSTMENT_MISMATCH",
      summary: item.released ? "Reserved refund funding references a downstream-released commission allocation." : "Cumulative refund commission adjustment exceeds original allocation evidence.",
    }));
  }
  return Object.freeze({ staleProcessingAttempts: stale.length, projectionMismatches, ledgerMismatches, commissionMismatches, scannedAt: now.toISOString() });
}

function journalTotalsEqual(journal: Readonly<{ type: string; currency: string; entries: readonly Readonly<{ direction: string; amount: Prisma.Decimal }>[] }> | null, expectedType: string, amount: Prisma.Decimal): boolean {
  if (!journal || journal.type !== expectedType || journal.currency !== "ZAR") return false;
  const debit = journal.entries.filter((entry) => entry.direction === "DEBIT").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0));
  const credit = journal.entries.filter((entry) => entry.direction === "CREDIT").reduce((sum, entry) => sum.add(entry.amount), new Prisma.Decimal(0));
  return debit.equals(amount) && credit.equals(amount);
}

async function openGenericRefundCase(tx: Prisma.TransactionClient, input: Readonly<{ refundId: string; refundReference: string; attemptId?: string; attemptReference?: string; reason: "STALE_PROCESSING_ATTEMPT" | "PAYMENT_REFUND_TOTAL_MISMATCH" | "REFUND_LEDGER_LINK_MISSING" | "REFUND_LEDGER_AMOUNT_MISMATCH" | "COMMISSION_ADJUSTMENT_MISMATCH" | "DOWNSTREAM_COMMISSION_RELEASE"; summary: string }>) {
  const caseKey = `refund:${input.refundReference}:${input.reason}:${input.attemptReference ?? "none"}`;
  const existing = await tx.refundReconciliationCase.findUnique({ where: { caseKey } });
  if (existing) return tx.refundReconciliationCase.update({ where: { id: existing.id }, data: { observationCount: { increment: 1 }, lastObservedAt: new Date() } });
  return tx.refundReconciliationCase.create({ data: { publicReference: `RRC-${randomUUID().replaceAll("-", "").toUpperCase()}`, caseKey, refundId: input.refundId, attemptId: input.attemptId, reason: input.reason, priority: "HIGH", safeSummary: input.summary } });
}
