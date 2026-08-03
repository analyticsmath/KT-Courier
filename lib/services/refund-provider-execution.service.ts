import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { assertRefundAttemptTransition } from "@/lib/refunds/refund-attempt-state-machine";
import { assertRefundCompletionControl } from "@/lib/refunds/refund-dual-control";
import { RefundError } from "@/lib/refunds/errors";
import { refundAttemptHash } from "@/lib/refunds/refund-idempotency";
import { assertRefundReserveJournalEvidence } from "@/lib/refunds/refund-ledger-evidence";
import { refundExternalPayoutPosting } from "@/lib/refunds/refund-ledger-policy";
import { assertRefundOperationId } from "@/lib/refunds/refund-note-policy";
import { assertRefundProductionActivation } from "@/lib/refunds/refund-production-readiness";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";
import type { ProviderRefundInput, ProviderRefundResult, RefundProviderAdapter } from "@/lib/refunds/providers/refund-provider-adapter";
import { validateRefundProviderResult, unknownRefundProviderResult } from "@/lib/refunds/providers/refund-provider-result";
import { RefundProviderRegistry } from "@/lib/refunds/providers/refund-provider-registry";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { completeStoreEarningRefundProjectionsWithinTransaction } from "./store-earning-refund.service";
import { completeDriverEarningRefundProjectionsWithinTransaction } from "./driver-earning-refund.service";

const DEFAULT_REFUND_PROVIDER_TIMEOUT_MS = 10_000;

function attemptReference(): string { return `RPA-${randomUUID().replaceAll("-", "").toUpperCase()}`; }
function reconciliationReference(): string { return `RRC-${randomUUID().replaceAll("-", "").toUpperCase()}`; }

type ExecutionDependencies = Readonly<{
  assertProductionReady?: () => void;
  registry?: RefundProviderRegistry;
  timeoutMs?: number;
}>;

export async function openRefundReconciliationCase(tx: Prisma.TransactionClient, input: Readonly<{
  refundId: string;
  refundReference: string;
  attemptId?: string;
  attemptReference?: string;
  reason: "UNKNOWN_PROVIDER_OUTCOME" | "PROVIDER_REFUND_ID_CONFLICT" | "INSUFFICIENT_CASH_CLEARING" | "APPLICATION_FAILURE_AFTER_PROVIDER_SUCCESS" | "UNSUPPORTED_PROVIDER_REFUND_METHOD" | "PROVIDER_QUERY_UNAVAILABLE";
  safeSummary: string;
  safeEvidence?: Prisma.InputJsonValue;
}>) {
  const caseKey = `refund:${input.refundReference}:${input.reason}:${input.attemptReference ?? "none"}`;
  const existing = await tx.refundReconciliationCase.findUnique({ where: { caseKey } });
  if (existing) return tx.refundReconciliationCase.update({ where: { id: existing.id }, data: { observationCount: { increment: 1 }, lastObservedAt: new Date(), safeEvidence: input.safeEvidence } });
  return tx.refundReconciliationCase.create({ data: { publicReference: reconciliationReference(), caseKey, refundId: input.refundId, attemptId: input.attemptId, reason: input.reason, priority: "HIGH", safeSummary: input.safeSummary, safeEvidence: input.safeEvidence } });
}

async function reserveProviderAttempt(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>, adapter: RefundProviderAdapter) {
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.publicReference} FOR UPDATE`);
    if (locked.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const refund = await tx.paymentRefund.findUnique({ where: { id: locked[0].id }, include: { payment: { include: { successfulAttempt: true } } } });
    if (!refund) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found.");
    const providerPaymentId = refund.payment.successfulAttempt?.providerReference;
    if (refund.method !== "ORIGINAL_PAYMENT_METHOD" || refund.status !== "APPROVED" || !providerPaymentId || refund.payment.provider !== adapter.code) {
      throw new RefundError("REFUND_INVALID_STATE", "Refund is not eligible for original-payment-method processing.");
    }
    if (!adapter.capabilities.supportsFullRefund || (!refund.amount.equals(refund.payment.amount) && !adapter.capabilities.supportsPartialRefund) || adapter.capabilities.requiresCustomerBankData) {
      await openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, reason: "UNSUPPORTED_PROVIDER_REFUND_METHOD", safeSummary: "Provider capabilities do not safely support this original-method refund." });
      return { refund, attempt: null, providerPaymentId, replayed: false as const, blocked: "UNSUPPORTED_PROVIDER_REFUND_METHOD" as const };
    }
    assertRefundCompletionControl({ customerUserId: refund.customerUserId ?? "", approvedByUserId: refund.approvedByUserId, completedByUserId: input.actorUserId });
    const requestHash = refundAttemptHash({ refundId: refund.id, actorUserId: input.actorUserId, provider: adapter.code, providerPaymentId });
    const replay = await tx.refundExecutionAttempt.findUnique({ where: { idempotencyKey: input.operationId } });
    if (replay) {
      if (replay.refundId !== refund.id || replay.requestHash !== requestHash) throw new RefundError("REFUND_IDEMPOTENCY_CONFLICT", "Operation ID belongs to a different provider refund attempt.");
      return { refund, attempt: replay, providerPaymentId, replayed: true as const, blocked: null };
    }
    const activeAttempt = await tx.refundExecutionAttempt.findFirst({ where: { refundId: refund.id, status: { in: ["RESERVED", "PROCESSING", "UNKNOWN"] } }, select: { id: true } });
    if (activeAttempt) throw new RefundError("REFUND_PROVIDER_OUTCOME_UNKNOWN", "Refund already has an unresolved provider attempt.");
    assertRefundTransition(refund.status, "PROCESSING");
    const number = refund.latestAttemptNumber + 1;
    const now = new Date();
    const created = await tx.refundExecutionAttempt.create({ data: { publicReference: attemptReference(), refundId: refund.id, attemptNumber: number, provider: adapter.code, method: refund.method, status: "RESERVED", idempotencyKey: input.operationId, requestHash, providerPaymentId, credentialVersion: refund.payment.successfulAttempt?.providerCredentialVersion, initiatedByUserId: input.actorUserId } });
    assertRefundAttemptTransition("RESERVED", "PROCESSING");
    const attempt = await tx.refundExecutionAttempt.update({ where: { id: created.id }, data: { status: "PROCESSING", startedAt: now, safeRequestSnapshot: { refundReference: refund.publicReference, paymentReference: refund.payment.publicReference, amount: refund.amount.toFixed(2), currency: "ZAR", provider: adapter.code }, version: { increment: 1 } } });
    await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "PROCESSING", latestAttemptNumber: number, currentAttemptId: attempt.id, version: { increment: 1 } } });
    await tx.refundStatusHistory.create({ data: { refundId: refund.id, attemptId: attempt.id, fromStatus: "APPROVED", toStatus: "PROCESSING", actorType: "FINANCE_ADMIN", actorUserId: input.actorUserId, operationId: input.operationId, reasonCode: "PROVIDER_ATTEMPT_STARTED", safeMetadata: { attemptReference: attempt.publicReference, provider: adapter.code } } });
    return { refund, attempt, providerPaymentId, replayed: false as const, blocked: null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function callRefundProvider(adapter: RefundProviderAdapter, request: ProviderRefundInput, attemptId: string, timeoutMs: number): Promise<ProviderRefundResult> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); const error = new Error("Refund provider call timed out."); error.name = "AbortError"; reject(error); }, timeoutMs);
  });
  try {
    return await Promise.race([adapter.createRefund(request, Object.freeze({ signal: controller.signal, correlationId: attemptId, timeoutMs })), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function finalizeProviderRefundAttempt(input: Readonly<{
  actorUserId: string;
  refundPublicReference: string;
  attemptPublicReference: string;
  result: ProviderRefundResult;
}>) {
  const validated = validateRefundProviderResult(input.result);
  try {
    return await withLedgerRetry(() => prisma.$transaction(async (tx) => {
      const refundRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.refundPublicReference} FOR UPDATE`);
      if (refundRows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund request was not found during provider finalization.");
      const attemptRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "RefundExecutionAttempt" WHERE "publicReference" = ${input.attemptPublicReference} FOR UPDATE`);
      if (attemptRows.length !== 1) throw new RefundError("REFUND_NOT_FOUND", "Refund attempt was not found during provider finalization.");
      const refund = await tx.paymentRefund.findUnique({ where: { id: refundRows[0].id }, include: { payment: true, reserveLedgerJournal: { include: { entries: { select: { accountId: true, direction: true, amount: true } } } } } });
      const attempt = await tx.refundExecutionAttempt.findUnique({ where: { id: attemptRows[0].id } });
      if (!refund || !attempt || attempt.refundId !== refund.id || refund.currentAttemptId !== attempt.id) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "Refund attempt identity is incoherent.");
      if (attempt.status === "SUCCEEDED" && refund.status === "SUCCEEDED" && validated.status === "SUCCEEDED" && attempt.providerRefundId === validated.providerRefundId) return refund;
      const reconciliationPath = refund.status === "RECONCILIATION_REQUIRED" && attempt.status === "UNKNOWN";
      if (!(refund.status === "PROCESSING" && attempt.status === "PROCESSING") && !reconciliationPath) throw new RefundError("REFUND_INVALID_STATE", "Refund attempt cannot be finalized from its current state.");
      assertRefundCompletionControl({ customerUserId: refund.customerUserId ?? "", approvedByUserId: refund.approvedByUserId, completedByUserId: input.actorUserId });
      const safeResultSnapshot = { status: validated.status, providerRefundId: validated.providerRefundId ?? null, providerPaymentId: validated.providerPaymentId ?? attempt.providerPaymentId, providerStatusCode: validated.providerStatusCode ?? null, safeProviderStatus: validated.safeProviderStatus ?? null, definitive: validated.definitive, safeMetadata: validated.safeMetadata ?? null };
      const now = new Date();
      if (validated.status === "PROCESSING") {
        if (reconciliationPath) {
          assertRefundAttemptTransition("UNKNOWN", "PROCESSING");
          assertRefundTransition("RECONCILIATION_REQUIRED", "PROCESSING");
          await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "PROCESSING", safeResultSnapshot, version: { increment: 1 } } });
          const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "PROCESSING", version: { increment: 1 } } });
          await tx.refundStatusHistory.create({ data: { refundId: refund.id, attemptId: attempt.id, fromStatus: "RECONCILIATION_REQUIRED", toStatus: "PROCESSING", actorType: "PROVIDER", actorUserId: input.actorUserId, reasonCode: "PROVIDER_STILL_PROCESSING" } });
          return updated;
        }
        await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { safeResultSnapshot, version: { increment: 1 } } });
        return refund;
      }
      if (validated.status === "FAILED") {
        if (reconciliationPath) {
          assertRefundAttemptTransition("UNKNOWN", "PROCESSING");
          assertRefundAttemptTransition("PROCESSING", "FAILED");
          assertRefundTransition("RECONCILIATION_REQUIRED", "PROCESSING");
          assertRefundTransition("PROCESSING", "APPROVED");
        } else {
          assertRefundAttemptTransition(attempt.status, "FAILED");
          assertRefundTransition(refund.status, "APPROVED");
        }
        await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", safeResultSnapshot, failureCategory: "DECLINED", failureCode: validated.providerStatusCode ?? "PROVIDER_REJECTED", failureMessage: "Provider definitively rejected the refund request.", failedAt: now, version: { increment: 1 } } });
        const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "APPROVED", currentAttemptId: null, version: { increment: 1 } } });
        if (reconciliationPath) {
          await tx.refundStatusHistory.createMany({ data: [
            { refundId: refund.id, attemptId: attempt.id, fromStatus: "RECONCILIATION_REQUIRED", toStatus: "PROCESSING", actorType: "PROVIDER", reasonCode: "PROVIDER_QUERY_RESOLVED" },
            { refundId: refund.id, attemptId: attempt.id, fromStatus: "PROCESSING", toStatus: "APPROVED", actorType: "PROVIDER", reasonCode: "PROVIDER_DEFINITELY_FAILED", safeMetadata: { providerStatusCode: validated.providerStatusCode ?? null } },
          ] });
        } else {
          await tx.refundStatusHistory.create({ data: { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "APPROVED", actorType: "PROVIDER", reasonCode: "PROVIDER_DEFINITELY_FAILED", safeMetadata: { providerStatusCode: validated.providerStatusCode ?? null } } });
        }
        return updated;
      }
      if (validated.status === "UNKNOWN") {
        if (!reconciliationPath) {
          assertRefundAttemptTransition(attempt.status, "UNKNOWN");
          assertRefundTransition(refund.status, "RECONCILIATION_REQUIRED");
        }
        await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", safeResultSnapshot, providerRefundId: validated.providerRefundId, failureCategory: "UNKNOWN_OUTCOME", failureCode: validated.providerStatusCode ?? "PROVIDER_OUTCOME_UNKNOWN", failureMessage: "Provider refund outcome requires reconciliation.", unknownAt: now, version: { increment: 1 } } });
        const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
        await openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "UNKNOWN_PROVIDER_OUTCOME", safeSummary: "Provider refund outcome could not be established safely.", safeEvidence: { providerStatusCode: validated.providerStatusCode ?? null, providerRefundId: validated.providerRefundId ?? null } });
        await tx.refundStatusHistory.createMany({ data: [
          { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "PROVIDER", reasonCode: "PROVIDER_OUTCOME_UNKNOWN" },
          { refundId: refund.id, attemptId: attempt.id, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_OPENED" },
        ] });
        return updated;
      }

      assertRefundAttemptTransition(attempt.status, "SUCCEEDED");
      assertRefundTransition(refund.status, "SUCCEEDED");
      if (!validated.providerRefundId) throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Provider success lacks refund reference.");
      const providerConflict = await tx.refundExecutionAttempt.findFirst({ where: { provider: attempt.provider, providerRefundId: validated.providerRefundId, id: { not: attempt.id } }, select: { id: true } });
      if (providerConflict) {
        await openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "PROVIDER_REFUND_ID_CONFLICT", safeSummary: "Provider refund reference conflicts with another attempt.", safeEvidence: { providerRefundId: validated.providerRefundId } });
        await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", providerRefundId: validated.providerRefundId, safeResultSnapshot, failureCategory: "UNKNOWN_OUTCOME", failureCode: "PROVIDER_REFUND_ID_CONFLICT", unknownAt: now, version: { increment: 1 } } });
        const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
        await tx.refundStatusHistory.createMany({ data: [
          { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "PROVIDER", reasonCode: "PROVIDER_REFUND_ID_CONFLICT" },
          { refundId: refund.id, attemptId: attempt.id, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_OPENED" },
        ] });
        return updated;
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${refund.paymentId} FOR UPDATE`);
      const held = await tx.ledgerAccount.findFirst({ where: { purpose: "CUSTOMER_REFUND_HELD", currency: "ZAR", wallet: { ownerType: "CUSTOMER", ownerId: refund.customerUserId ?? undefined, status: "ACTIVE" } } });
      const cash = await tx.ledgerAccount.findUnique({ where: { code: "PLATFORM-CASH-CLEARING-ZAR" } });
      if (!held || !cash || held.category !== "LIABILITY" || cash.category !== "ASSET" || held.allowNegative || cash.allowNegative) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund completion accounts are invalid.");
      const accountIds = [held.id, cash.id].sort();
      const lockedAccounts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
      if (lockedAccounts.length !== 2) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund completion accounts could not be locked.");
      assertRefundReserveJournalEvidence({ refundAmount: refund.amount, heldAccountId: held.id, journal: refund.reserveLedgerJournal });
      const [heldAfterLock, cashAfterLock] = await Promise.all([tx.ledgerAccount.findUnique({ where: { id: held.id } }), tx.ledgerAccount.findUnique({ where: { id: cash.id } })]);
      if (!heldAfterLock || LedgerMoney.fromDecimal(heldAfterLock.currentBalance).lessThan(LedgerMoney.fromDecimal(refund.amount))) throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund-held liability does not cover external completion.");
      if (!cashAfterLock || LedgerMoney.fromDecimal(cashAfterLock.currentBalance).lessThan(LedgerMoney.fromDecimal(refund.amount))) {
        await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", safeResultSnapshot, providerRefundId: validated.providerRefundId, failureCategory: "UNKNOWN_OUTCOME", failureCode: "INSUFFICIENT_CASH_CLEARING", unknownAt: now, version: { increment: 1 } } });
        const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
        await openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: "INSUFFICIENT_CASH_CLEARING", safeSummary: "Provider reports success but platform cash clearing cannot post the external refund journal.", safeEvidence: { providerRefundId: validated.providerRefundId } });
        await tx.refundStatusHistory.createMany({ data: [
          { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "PROVIDER", reasonCode: "INSUFFICIENT_CASH_CLEARING" },
          { refundId: refund.id, attemptId: attempt.id, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_OPENED" },
        ] });
        return updated;
      }
      const journal = await postLedgerJournalWithinTransaction(tx, refundExternalPayoutPosting({ refundReference: refund.publicReference, paymentReference: refund.payment.publicReference, amount: refund.amount.toFixed(2), heldAccountId: held.id, cashClearingAccountId: cash.id, attemptReference: attempt.publicReference, providerRefundId: validated.providerRefundId, actorUserId: input.actorUserId }));
      const projection = await tx.payment.updateMany({ where: { id: refund.paymentId, version: refund.payment.version, totalRefundReservedAmount: { gte: refund.amount } }, data: { totalRefundReservedAmount: { decrement: refund.amount }, totalRefundedAmount: { increment: refund.amount }, version: { increment: 1 } } });
      if (projection.count !== 1) throw new RefundError("REFUND_CONCURRENCY_CONFLICT", "External refund completion lost a concurrent payment update.", true);
      await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED", providerRefundId: validated.providerRefundId, providerPaymentId: validated.providerPaymentId ?? attempt.providerPaymentId, safeResultSnapshot, completedByUserId: input.actorUserId, completedAt: now, version: { increment: 1 } } });
      await completeStoreEarningRefundProjectionsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
      await completeDriverEarningRefundProjectionsWithinTransaction(tx, { refundId: refund.id, refundPublicReference: refund.publicReference, actorUserId: input.actorUserId });
      const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "SUCCEEDED", completionLedgerJournalId: journal.id, completedByUserId: input.actorUserId, completedAt: now, reconciliationRequiredAt: null, version: { increment: 1 } } });
      await tx.refundReconciliationCase.updateMany({ where: { refundId: refund.id, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "PROVIDER_SUCCESS_POSTED", resolvedByUserId: input.actorUserId } });
      await tx.refundStatusHistory.create({ data: { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "SUCCEEDED", actorType: "PROVIDER", actorUserId: input.actorUserId, reasonCode: "PROVIDER_REFUND_SUCCEEDED", safeMetadata: { attemptReference: attempt.publicReference, providerRefundId: validated.providerRefundId, completionJournalReference: journal.reference } } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") throw new RefundError("REFUND_PROVIDER_REFERENCE_CONFLICT", "Provider refund reference conflicts with existing evidence.");
    throw error;
  }
}

export async function startProviderRefund(input: Readonly<{ actorUserId: string; publicReference: string; operationId: string }>, dependencies: ExecutionDependencies = {}) {
  (dependencies.assertProductionReady ?? assertRefundProductionActivation)();
  const operationId = assertRefundOperationId(input.operationId);
  const preflight = await prisma.paymentRefund.findUnique({ where: { publicReference: input.publicReference }, include: { payment: true } });
  if (!preflight || preflight.payment.provider !== "PAYFAST") throw new RefundError("REFUND_PROVIDER_UNSUPPORTED", "Refund provider is unavailable.");
  const registry = dependencies.registry ?? new RefundProviderRegistry();
  const adapter = registry.getAdapter("PAYFAST");
  const reservation = await reserveProviderAttempt({ ...input, operationId }, adapter);
  if (reservation.blocked) throw new RefundError("REFUND_PROVIDER_UNSUPPORTED", "Provider cannot safely execute this refund method; reconciliation was opened.");
  if (reservation.replayed) return reservation.refund;
  if (!reservation.attempt) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Refund provider attempt was not reserved.");
  const request: ProviderRefundInput = Object.freeze({ refundPublicReference: reservation.refund.publicReference, paymentPublicReference: reservation.refund.payment.publicReference, providerPaymentId: reservation.providerPaymentId, amount: reservation.refund.amount.toFixed(2), currency: "ZAR", reasonCode: reservation.refund.reasonCode, providerOperationKey: reservation.attempt.publicReference });
  let result: ProviderRefundResult;
  try {
    result = validateRefundProviderResult(await callRefundProvider(adapter, request, reservation.attempt.id, Math.min(Math.max(dependencies.timeoutMs ?? DEFAULT_REFUND_PROVIDER_TIMEOUT_MS, 100), 30_000)));
  } catch (error) {
    result = unknownRefundProviderResult(error);
  }
  try {
    return await finalizeProviderRefundAttempt({ actorUserId: input.actorUserId, refundPublicReference: reservation.refund.publicReference, attemptPublicReference: reservation.attempt.publicReference, result });
  } catch (error) {
    if (result.status !== "SUCCEEDED") throw error;
    return recordApplicationFailureAfterProviderSuccess({ actorUserId: input.actorUserId, refundPublicReference: reservation.refund.publicReference, attemptPublicReference: reservation.attempt.publicReference, result });
  }
}

async function recordApplicationFailureAfterProviderSuccess(input: Readonly<{ actorUserId: string; refundPublicReference: string; attemptPublicReference: string; result: ProviderRefundResult }>) {
  return prisma.$transaction(async (tx) => {
    const refundRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PaymentRefund" WHERE "publicReference" = ${input.refundPublicReference} FOR UPDATE`);
    const attemptRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "RefundExecutionAttempt" WHERE "publicReference" = ${input.attemptPublicReference} FOR UPDATE`);
    const refund = refundRows.length === 1 ? await tx.paymentRefund.findUnique({ where: { id: refundRows[0].id } }) : null;
    const attempt = attemptRows.length === 1 ? await tx.refundExecutionAttempt.findUnique({ where: { id: attemptRows[0].id } }) : null;
    if (!refund || !attempt || attempt.refundId !== refund.id) throw new RefundError("REFUND_PROVIDER_OUTCOME_UNKNOWN", "Provider succeeded but application evidence could not be recovered.");
    if (refund.status === "SUCCEEDED") return refund;
    const now = new Date();
    const conflict = input.result.providerRefundId
      ? await tx.refundExecutionAttempt.findFirst({ where: { provider: attempt.provider, providerRefundId: input.result.providerRefundId, id: { not: attempt.id } }, select: { id: true } })
      : null;
    const reconciliationReason = conflict ? "PROVIDER_REFUND_ID_CONFLICT" as const : "APPLICATION_FAILURE_AFTER_PROVIDER_SUCCESS" as const;
    if (attempt.status === "PROCESSING") {
      await tx.refundExecutionAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", ...(!conflict && { providerRefundId: input.result.providerRefundId }), safeResultSnapshot: { status: input.result.status, providerRefundId: input.result.providerRefundId ?? null, providerStatusCode: input.result.providerStatusCode ?? null, definitive: input.result.definitive }, failureCategory: "UNKNOWN_OUTCOME", failureCode: reconciliationReason, failureMessage: "Provider success could not be finalized atomically and requires reconciliation.", unknownAt: now, version: { increment: 1 } } });
    }
    const updated = await tx.paymentRefund.update({ where: { id: refund.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationRequiredAt: now, version: { increment: 1 } } });
    await openRefundReconciliationCase(tx, { refundId: refund.id, refundReference: refund.publicReference, attemptId: attempt.id, attemptReference: attempt.publicReference, reason: reconciliationReason, safeSummary: conflict ? "Provider refund reference conflicts with existing immutable attempt evidence." : "Provider reported refund success but atomic application finalization failed.", safeEvidence: { providerRefundId: input.result.providerRefundId ?? null, providerStatusCode: input.result.providerStatusCode ?? null } });
    await tx.refundStatusHistory.createMany({ data: [
      { refundId: refund.id, attemptId: attempt.id, fromStatus: refund.status, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", actorUserId: input.actorUserId, reasonCode: reconciliationReason },
      { refundId: refund.id, attemptId: attempt.id, toStatus: "RECONCILIATION_REQUIRED", actorType: "SYSTEM", reasonCode: "RECONCILIATION_OPENED" },
    ] });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
