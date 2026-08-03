import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { storeEarningReversalPosting } from "@/lib/store-earnings/store-earning-ledger-policy";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";
import { assertStoreEarningsProductionReady } from "@/lib/store-earnings/store-earning-production-readiness";
import { assertStoreEarningReversalPolicy, STORE_EARNING_REVERSAL_REASON_CODES, type StoreEarningReversalReasonCode } from "@/lib/store-earnings/store-earning-reversal-policy";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";
import { openStoreEarningReconciliationWithinTransaction, resolveStoreEarningReconciliationsWithinTransaction } from "./store-earning-reconciliation.service";

const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;

export type FrozenStoreEarningForAdjustment = Readonly<{
  publicReference: string;
  originalSellerBasis: string;
  originalCommission: string;
  originalAmount: string;
  previouslyAdjustedAmount: string;
}>;

/** Canonical Phase 16 transaction primitive for a bounded Phase 21 adjustment. */
export async function adjustStoreEarningInTransaction(
  tx: Prisma.TransactionClient,
  originalStoreEarningEvidence: FrozenStoreEarningForAdjustment,
  adjustmentEvidence: Readonly<{ sellerBasisAmount: string; commissionAmount: string; storeEarningAmount: string }>,
  operationEvidence: Readonly<{ operationId: string; actorUserId?: string; reasonCode: string }>,
) {
  if (!OPERATION_ID.test(operationEvidence.operationId) || !/^[A-Z][A-Z0-9_]{2,79}$/.test(operationEvidence.reasonCode)) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "A valid immutable store-earning adjustment operation is required.");
  const sellerBasis = new Prisma.Decimal(adjustmentEvidence.sellerBasisAmount);
  const commission = new Prisma.Decimal(adjustmentEvidence.commissionAmount);
  const amount = new Prisma.Decimal(adjustmentEvidence.storeEarningAmount);
  const originalAmount = new Prisma.Decimal(originalStoreEarningEvidence.originalAmount);
  const prior = new Prisma.Decimal(originalStoreEarningEvidence.previouslyAdjustedAmount);
  if (sellerBasis.lessThan(0) || commission.lessThan(0) || !sellerBasis.sub(commission).equals(amount) || amount.lessThan(0) || prior.add(amount).greaterThan(originalAmount)) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "Store earning adjustment does not reconcile to immutable seller basis and commission evidence.");
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "publicReference" = ${originalStoreEarningEvidence.publicReference} FOR UPDATE`);
  if (locked.length !== 1) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Frozen store earning evidence is unavailable.");
  const earning = await tx.storeEarning.findUnique({ where: { id: locked[0].id }, include: { payableAccount: true } });
  if (!earning || !earning.settlementBasisAmount.equals(new Prisma.Decimal(originalStoreEarningEvidence.originalSellerBasis)) || !earning.attributedCommissionAmount.equals(new Prisma.Decimal(originalStoreEarningEvidence.originalCommission)) || !earning.amount.equals(originalAmount) || earning.status !== "ACCRUED" || earning.releaseLedgerJournalId || !earning.releasedAmount.isZero()) throw new StoreEarningError("STORE_EARNING_REVERSAL_NOT_ALLOWED", "Store earning is not eligible for a bounded adjustment.");
  const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  if (!held || earning.payableAccount.status !== "ACTIVE") throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "Canonical earning accounts are unavailable.");
  const accountIds = [earning.payableAccountId, held.id].sort();
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LedgerAccount" WHERE "id" IN (${Prisma.join(accountIds)}) ORDER BY "id" ASC FOR UPDATE`);
  const journal = await postLedgerJournalWithinTransaction(tx, storeEarningReversalPosting({ earningReference: earning.publicReference, amount: formatStoreEarningMoney(amount), storePayableAccountId: earning.payableAccountId, customerFundsHeldAccountId: held.id, storePublicReference: earning.storePublicReference, subjectPublicReference: earning.subjectPublicReference, settlementVersion: earning.settlementVersion, reasonCode: operationEvidence.reasonCode, operationId: operationEvidence.operationId, actorUserId: operationEvidence.actorUserId }));
  await tx.storeEarning.update({ where: { id: earning.id }, data: { reversedAmount: { increment: amount }, version: { increment: 1 }, statusHistory: { create: { fromStatus: earning.status, toStatus: earning.status, actorType: operationEvidence.actorUserId ? "USER" : "SYSTEM", actorId: operationEvidence.actorUserId ?? null, reasonCode: operationEvidence.reasonCode, safeMetadata: { operationId: operationEvidence.operationId, sellerBasisAmount: formatStoreEarningMoney(sellerBasis), commissionAmount: formatStoreEarningMoney(commission), reversalLedgerReference: journal.reference } } } } });
  return Object.freeze({ storeEarningReference: earning.publicReference, reversalLedgerJournalReference: journal.reference, amount: formatStoreEarningMoney(amount), replayed: false });
}

export async function reverseStoreEarning(input: Readonly<{ earningId: string; operationId: string; reasonCode: StoreEarningReversalReasonCode; actorUserId: string; safeNote?: string }>, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertStoreEarningsProductionReady(options);
  if (!OPERATION_ID.test(input.operationId) || !STORE_EARNING_REVERSAL_REASON_CODES.includes(input.reasonCode) || (input.safeNote && input.safeNote.length > 240)) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "A valid approved store earning reversal command is required.");
  return withLedgerRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" = ${input.earningId} FOR UPDATE`);
    if (locked.length !== 1) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Store earning was not found.");
    const earning = await tx.storeEarning.findUnique({ where: { id: input.earningId }, include: { payableAccount: true, reversalLedgerJournal: { select: { reference: true } }, commissionCharges: { select: { id: true, commissionAllocationId: true } }, reconciliationCases: { select: { reason: true, status: true } } } });
    if (!earning) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Store earning was not found.");
    if (earning.status === "REVERSED" && earning.reversalLedgerJournal) return Object.freeze({ publicReference: earning.publicReference, status: earning.status, reversedAmount: formatStoreEarningMoney(earning.reversedAmount), reversalLedgerJournalReference: earning.reversalLedgerJournal.reference, idempotent: true });
    if (earning.releaseLedgerJournalId || !earning.releasedAmount.isZero() || earning.status === "RELEASED") {
      await openStoreEarningReconciliationWithinTransaction(tx, { caseKey: `store-earning:reversal-after-release:${earning.id}`, storeEarningId: earning.id, reason: "REVERSAL_AFTER_RELEASE", priority: "CRITICAL", safeSummary: "Direct store payable reversal is blocked after owner-withdrawable release." });
      return Object.freeze({ publicReference: earning.publicReference, status: earning.status, reversalBlocked: true, blockReason: "REVERSAL_AFTER_RELEASE" as const });
    }
    const chargeLocks = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "StoreEarningCommissionCharge" WHERE "storeEarningId" = ${earning.id} ORDER BY "id" ASC FOR UPDATE`);
    const allocationIds = earning.commissionCharges.map((charge) => charge.commissionAllocationId).sort();
    if (allocationIds.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "id" IN (${Prisma.join(allocationIds)}) ORDER BY "id" ASC FOR UPDATE`);
    const allocations = allocationIds.length ? await tx.commissionAllocation.findMany({ where: { id: { in: allocationIds } }, select: { status: true, accrual: { select: { id: true, status: true } } }, orderBy: { id: "asc" } }) : [];
    const commissionCoherent = chargeLocks.length === earning.commissionCharges.length && allocations.length === allocationIds.length && allocations.every((allocation) => allocation.status === "REVERSED" && allocation.accrual.status === "REVERSED");
    if (!commissionCoherent) {
      const commissionAccrualId = allocations.find((allocation) => allocation.accrual.status !== "REVERSED")?.accrual.id;
      await openStoreEarningReconciliationWithinTransaction(tx, { caseKey: `store-earning:commission-reversal:${earning.id}`, storeEarningId: earning.id, commissionAccrualId, reason: "REVERSAL_BLOCKED_BY_COMMISSION", priority: "HIGH", safeSummary: "Related attributed commission must be canonically reversed before the store entitlement can be reversed." });
      if (earning.status === "ACCRUED") await tx.storeEarning.update({ where: { id: earning.id }, data: { status: "RECONCILIATION_REQUIRED", version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "RECONCILIATION_REQUIRED", actorType: "USER", actorId: input.actorUserId, reasonCode: "REVERSAL_BLOCKED_BY_COMMISSION" } } } });
      return Object.freeze({ publicReference: earning.publicReference, status: "RECONCILIATION_REQUIRED" as const, reversalBlocked: true, blockReason: "REVERSAL_BLOCKED_BY_COMMISSION" as const });
    }
    const remaining = earning.amount.sub(earning.refundedAmount).sub(earning.reversedAmount);
    assertStoreEarningReversalPolicy({ status: earning.status, releasedAmount: earning.releasedAmount, refundReservedAmount: earning.refundReservedAmount, remainingAmount: remaining, releaseLedgerJournalId: earning.releaseLedgerJournalId, reversalLedgerJournalId: earning.reversalLedgerJournalId, commissionTreatmentCoherent: true, reviewedReconciliation: earning.status === "RECONCILIATION_REQUIRED" && earning.reconciliationCases.some((record) => record.reason === "REVERSAL_BLOCKED_BY_COMMISSION" && (record.status === "OPEN" || record.status === "MONITORING")) });
    const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
    if (!held || earning.payableAccount.status !== "ACTIVE" || earning.payableAccount.purpose !== "STORE_EARNINGS_PAYABLE" || earning.payableAccount.category !== "LIABILITY" || earning.payableAccount.currentBalance.lessThan(remaining)) throw new StoreEarningError("STORE_EARNING_REVERSAL_NOT_ALLOWED", "Store payable or customer-funds-held account evidence is invalid for reversal.");
    const amount = formatStoreEarningMoney(remaining);
    const journal = await postLedgerJournalWithinTransaction(tx, storeEarningReversalPosting({ earningReference: earning.publicReference, amount, storePayableAccountId: earning.payableAccountId, customerFundsHeldAccountId: held.id, storePublicReference: earning.storePublicReference, subjectPublicReference: earning.subjectPublicReference, settlementVersion: earning.settlementVersion, reasonCode: input.reasonCode, actorUserId: input.actorUserId }));
    const now = new Date();
    await tx.storeEarning.update({ where: { id: earning.id }, data: { status: "REVERSED", reversedAmount: remaining, reversalLedgerJournalId: journal.id, reversedAt: now, reversalReasonCode: input.reasonCode, version: { increment: 1 }, statusHistory: { create: { fromStatus: earning.status, toStatus: "REVERSED", actorType: "USER", actorId: input.actorUserId, reasonCode: input.reasonCode, safeMetadata: { ledgerReference: journal.reference, safeNote: input.safeNote ?? "" } } } } });
    await resolveStoreEarningReconciliationsWithinTransaction(tx, { storeEarningId: earning.id, canonicalOperationReference: journal.reference, resolutionCode: "CANONICAL_REVERSAL" });
    return Object.freeze({ publicReference: earning.publicReference, status: "REVERSED" as const, reversedAmount: amount, reversalLedgerJournalReference: journal.reference, idempotent: false });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
