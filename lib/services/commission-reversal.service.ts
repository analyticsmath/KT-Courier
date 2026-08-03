import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertCommissionProductionReady } from "@/lib/commissions/commission-production-readiness";
import { commissionAdjustmentReversalPosting, commissionReversalPosting } from "@/lib/commissions/commission-ledger-policy";
import { CommissionError } from "@/lib/commissions/errors";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { withLedgerRetry } from "@/lib/ledger/retry";

const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const operationId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;

export type FrozenCommissionAllocationForReversal = Readonly<{
  accrualPublicReference: string;
  allocationPublicReference: string;
  originalAmount: string;
  previouslyReversedAmount: string;
}>;

export type CommissionAdjustmentOperationEvidence = Readonly<{ operationId: string; actorUserId?: string; reasonCode: string }>;

/**
 * Canonical Phase 14 transaction primitive for a bounded immutable allocation
 * reversal. It deliberately receives frozen allocation evidence; it never
 * resolves the current commission plan.
 */
export async function reverseCommissionInTransaction(
  tx: Prisma.TransactionClient,
  frozenOriginalAllocation: FrozenCommissionAllocationForReversal,
  adjustmentAllocation: Readonly<{ amount: string }>,
  operationEvidence: CommissionAdjustmentOperationEvidence,
) {
  if (!operationId.test(operationEvidence.operationId) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(operationEvidence.reasonCode)) throw new CommissionError("COMMISSION_INVALID_COMMAND", "A valid immutable commission adjustment operation is required.");
  const adjustment = new Prisma.Decimal(adjustmentAllocation.amount);
  const original = new Prisma.Decimal(frozenOriginalAllocation.originalAmount);
  const prior = new Prisma.Decimal(frozenOriginalAllocation.previouslyReversedAmount);
  if (adjustment.lessThanOrEqualTo(0) || prior.lessThan(0) || prior.add(adjustment).greaterThan(original)) throw new CommissionError("COMMISSION_REVERSAL_NOT_ALLOWED", "Commission adjustment exceeds its frozen allocation evidence.");
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CommissionAccrual" WHERE "publicReference" = ${frozenOriginalAllocation.accrualPublicReference} FOR UPDATE`);
  if (rows.length !== 1) throw new CommissionError("COMMISSION_ACCRUAL_NOT_FOUND", "Frozen commission accrual evidence is unavailable.");
  const allocationRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "publicReference" = ${frozenOriginalAllocation.allocationPublicReference} FOR UPDATE`);
  if (allocationRows.length !== 1) throw new CommissionError("COMMISSION_ACCRUAL_NOT_FOUND", "Frozen commission allocation evidence is unavailable.");
  const allocation = await tx.commissionAllocation.findUnique({ where: { id: allocationRows[0].id }, include: { accrual: { include: { ledgerJournal: { select: { id: true } } } } } });
  if (!allocation || allocation.accrual.publicReference !== frozenOriginalAllocation.accrualPublicReference || !allocation.amount.equals(original) || allocation.status !== "ACCRUED" || allocation.downstreamReleaseJournalId) throw new CommissionError("COMMISSION_REVERSAL_NOT_ALLOWED", "Commission allocation is not eligible for a bounded reversal.");
  const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  if (!held) throw new CommissionError("COMMISSION_ACCOUNT_INVALID", "Canonical customer-funds-held account is unavailable.");
  const accountIds = [held.id, allocation.ledgerAccountId].sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
  const journal = await postLedgerJournalWithinTransaction(tx, commissionAdjustmentReversalPosting({ accrualReference: allocation.accrual.publicReference, originalJournalId: allocation.accrual.ledgerJournal.id, heldAccountId: held.id, allocationAccountId: allocation.ledgerAccountId, amount: adjustment.toFixed(2), operationId: operationEvidence.operationId, actorUserId: operationEvidence.actorUserId }));
  await tx.commissionStatusHistory.create({ data: { accrualId: allocation.accrualId, fromStatus: allocation.accrual.status, toStatus: allocation.accrual.status, actorType: operationEvidence.actorUserId ? "USER" : "SYSTEM", actorId: operationEvidence.actorUserId ?? null, reasonCode: operationEvidence.reasonCode, safeMetadata: { adjustmentAmount: adjustment.toFixed(2), allocationReference: allocation.publicReference, reversalLedgerReference: journal.reference, operationId: operationEvidence.operationId } } });
  return Object.freeze({ commissionAccrualReference: allocation.accrual.publicReference, commissionAllocationReference: allocation.publicReference, reversalLedgerJournalReference: journal.reference, amount: adjustment.toFixed(2), replayed: false });
}

export async function reverseCommissionAccrual(input: Readonly<{ accrualId: string; operationId: string; reasonCode: string; actorUserId: string }>, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertCommissionProductionReady(options);
  if (!operationId.test(input.operationId) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(input.reasonCode)) throw new CommissionError("COMMISSION_INVALID_COMMAND", "A valid reversal operation ID and reason code are required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CommissionAccrual" WHERE "id" = ${input.accrualId} FOR UPDATE`);
    const accrual = await tx.commissionAccrual.findUnique({ where: { id: input.accrualId }, include: { allocations: { orderBy: { id: "asc" } }, ledgerJournal: { include: { entries: { orderBy: { sequence: "asc" } } } }, reversalLedgerJournal: { select: { reference: true } } } });
    if (!accrual) throw new CommissionError("COMMISSION_ACCRUAL_NOT_FOUND", "Commission accrual was not found.");
    if (accrual.status === "REVERSED" && accrual.reversalLedgerJournal) return Object.freeze({ publicReference: accrual.publicReference, status: accrual.status, reversalLedgerJournalReference: accrual.reversalLedgerJournal.reference, idempotent: true });
    if (accrual.status !== "ACCRUED" || accrual.reversalLedgerJournalId || !accrual.ledgerJournal) throw new CommissionError("COMMISSION_REVERSAL_NOT_ALLOWED", "The commission accrual cannot be reversed in its current state.");
    const released = accrual.allocations.find((allocation) => allocation.status === "RELEASED" || allocation.downstreamReleaseJournalId);
    if (released) {
      await tx.commissionReconciliationCase.upsert({ where: { caseKey: `commission-release:${released.id}` }, update: { observationCount: { increment: 1 }, lastObservedAt: new Date(), status: "OPEN" }, create: { publicReference: ref("CRC"), caseKey: `commission-release:${released.id}`, accrualId: accrual.id, allocationId: released.id, reason: "DOWNSTREAM_RELEASE_EXISTS", status: "OPEN", priority: "HIGH", safeSummary: "A downstream release prevents direct commission reversal." } });
      await tx.commissionAccrual.update({ where: { id: accrual.id }, data: { status: "RECONCILIATION_REQUIRED", version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "RECONCILIATION_REQUIRED", actorType: "USER", actorId: input.actorUserId, reasonCode: "DOWNSTREAM_RELEASE_EXISTS" } } } });
      return Object.freeze({ publicReference: accrual.publicReference, status: "RECONCILIATION_REQUIRED", reversalBlocked: true });
    }
    if (accrual.allocations.some((allocation) => allocation.status !== "ACCRUED")) throw new CommissionError("COMMISSION_REVERSAL_NOT_ALLOWED", "Only wholly accrued commission allocations can be reversed.");
    const accountIds = [...new Set(accrual.ledgerJournal.entries.map((entry) => entry.accountId))].sort();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
    const journal = await postLedgerJournalWithinTransaction(tx, commissionReversalPosting({ accrualReference: accrual.publicReference, originalJournalId: accrual.ledgerJournalId, originalEntries: accrual.ledgerJournal.entries.map((entry) => ({ accountId: entry.accountId, direction: entry.direction, amount: entry.amount.toFixed(2), lineCode: entry.lineCode })), actorUserId: input.actorUserId }));
    const now = new Date();
    await tx.commissionAllocation.updateMany({ where: { accrualId: accrual.id, status: "ACCRUED" }, data: { status: "REVERSED", updatedAt: now } });
    await tx.commissionAccrual.update({ where: { id: accrual.id }, data: { status: "REVERSED", reversalLedgerJournalId: journal.id, reversedAt: now, reversalReasonCode: input.reasonCode, version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "REVERSED", actorType: "USER", actorId: input.actorUserId, reasonCode: input.reasonCode, safeMetadata: { reversalLedgerReference: journal.reference } } } } });
    await tx.commissionReconciliationCase.updateMany({ where: { accrualId: accrual.id, status: { in: ["OPEN", "MONITORING"] } }, data: { status: "RESOLVED", resolvedAt: now, resolutionCode: "CANONICAL_REVERSAL" } });
    return Object.freeze({ publicReference: accrual.publicReference, status: "REVERSED", reversalLedgerJournalReference: journal.reference, idempotent: false });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
