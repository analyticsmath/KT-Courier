import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { hashStoreSettlementSnapshot } from "@/lib/store-earnings/store-earning-idempotency";
import { storeEarningAccrualPosting } from "@/lib/store-earnings/store-earning-ledger-policy";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";
import { assertStoreEarningsProductionReady } from "@/lib/store-earnings/store-earning-production-readiness";
import { validateStoreSettlementSnapshot, type StoreSettlementSnapshot } from "@/lib/store-earnings/store-settlement-snapshot";
import { ensureStoreEarningPayableAccount, resolveStoreEarningPayableAccountWithinTransaction } from "./store-earning-account.service";
import { postLedgerJournalWithinTransaction } from "./ledger-posting.service";

const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const reference = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;

export type StoreEarningAccrualCommand = Readonly<{
  operationId: string;
  snapshot: StoreSettlementSnapshot;
  actorUserId?: string;
}>;

export type StoreCommissionAllocationEvidence = Readonly<{ id: string; publicReference: string; amount: string; currency: "ZAR" }>;
export type StoreEarningOperationEvidence = Readonly<{ operationId: string; actorUserId?: string; commissionSubjectId?: string; payableAccountId?: string }>;

const include = {
  accrualLedgerJournal: { select: { reference: true } },
  releaseLedgerJournal: { select: { reference: true } },
  reversalLedgerJournal: { select: { reference: true } },
} as const;

function internalDto(row: Readonly<{ id: string; publicReference: string; status: string; amount: Prisma.Decimal; settlementBasisAmount: Prisma.Decimal; attributedCommissionAmount: Prisma.Decimal; currency: string; accrualLedgerJournal: { reference: string }; releaseLedgerJournal: { reference: string } | null; reversalLedgerJournal: { reference: string } | null }>) {
  return Object.freeze({ id: row.id, publicReference: row.publicReference, status: row.status, settlementBasisAmount: formatStoreEarningMoney(row.settlementBasisAmount), attributedCommissionAmount: formatStoreEarningMoney(row.attributedCommissionAmount), amount: formatStoreEarningMoney(row.amount), currency: row.currency, accrualLedgerJournalReference: row.accrualLedgerJournal.reference, releaseLedgerJournalReference: row.releaseLedgerJournal?.reference ?? null, reversalLedgerJournalReference: row.reversalLedgerJournal?.reference ?? null });
}

function assertVerifiedPayment(payment: Readonly<{
  id: string; publicReference: string; orderId: string | null; status: string; currency: string; totalRefundedAmount: Prisma.Decimal; totalRefundReservedAmount: Prisma.Decimal; successLedgerJournalId: string | null;
  successfulAttempt: { status: string } | null; successWebhookEvent: { processingStatus: string; signatureVerified: boolean; merchantVerified: boolean; amountVerified: boolean; providerDataVerified: boolean } | null;
  successLedgerJournal: { type: string; currency: string } | null;
}>): void {
  const webhook = payment.successWebhookEvent;
  if (payment.status !== "SUCCEEDED" || payment.currency !== "ZAR" || payment.successfulAttempt?.status !== "SUCCEEDED" || !payment.successLedgerJournalId || payment.successLedgerJournal?.type !== "EXTERNAL_PAYMENT_RECEIPT" || payment.successLedgerJournal.currency !== "ZAR" || !webhook || webhook.processingStatus !== "APPLIED" || !webhook.signatureVerified || !webhook.merchantVerified || !webhook.amountVerified || !webhook.providerDataVerified) {
    throw new StoreEarningError("STORE_EARNING_PAYMENT_INVALID", "Store earning accrual requires a verified successful ZAR payment and receipt journal.");
  }
  if (!payment.totalRefundedAmount.isZero() || !payment.totalRefundReservedAmount.isZero()) {
    throw new StoreEarningError("STORE_EARNING_REFUND_EVIDENCE_REQUIRED", "Store earning accrual is blocked while payment-level refund exposure lacks authoritative store allocation evidence.");
  }
}

export async function accrueStoreEarningInTransaction(tx: Prisma.TransactionClient, authoritativeStoreSettlementSnapshot: StoreSettlementSnapshot, commissionAllocations: readonly StoreCommissionAllocationEvidence[], operationEvidence: StoreEarningOperationEvidence) {
  if (!OPERATION_ID.test(operationEvidence.operationId.trim())) throw new StoreEarningError("STORE_EARNING_INVALID_COMMAND", "A valid internal operation ID is required.");
  const snapshot = validateStoreSettlementSnapshot(authoritativeStoreSettlementSnapshot);
  const evidenceById = new Map(commissionAllocations.map((allocation) => [allocation.id, allocation]));
  for (const charge of snapshot.commissionCharges) {
    const evidence = evidenceById.get(charge.commissionAllocationId);
    if (!evidence || evidence.publicReference !== charge.commissionAllocationPublicReference || evidence.currency !== "ZAR" || evidence.amount !== charge.amount) throw new StoreEarningError("STORE_EARNING_COMMISSION_INVALID", "Phase 14 allocation evidence does not match the frozen store settlement snapshot.");
  }
  const calculationHash = hashStoreSettlementSnapshot(snapshot);
  const replay = await tx.storeEarning.findUnique({ where: { creationIdempotencyKey: operationEvidence.operationId }, include });
  if (replay) {
    if (replay.creationRequestHash !== calculationHash) throw new StoreEarningError("STORE_EARNING_IDEMPOTENCY_CONFLICT", "Operation ID is associated with different store settlement evidence.");
    return Object.freeze({ ...internalDto(replay), replayed: true });
  }
  const store = await tx.store.findUnique({ where: { id: snapshot.storeId }, select: { id: true, slug: true, status: true } });
  if (!store || store.status !== "ACTIVE" || store.slug !== snapshot.storePublicReference) throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "Authoritative settlement does not identify the active canonical store.");
  const paymentLock = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${snapshot.paymentId} FOR UPDATE`);
  if (paymentLock.length !== 1) throw new StoreEarningError("STORE_EARNING_PAYMENT_INVALID", "Verified payment disappeared during store settlement accrual.");
  const lockedPayment = await tx.payment.findUnique({ where: { id: snapshot.paymentId }, include: { successfulAttempt: { select: { status: true } }, successWebhookEvent: { select: { processingStatus: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true } }, successLedgerJournal: { select: { type: true, currency: true } } } });
  if (!lockedPayment || lockedPayment.publicReference !== snapshot.paymentPublicReference) throw new StoreEarningError("STORE_EARNING_PAYMENT_INVALID", "Payment identity changed during store settlement accrual.");
  assertVerifiedPayment(lockedPayment);
  const chargeIds = [...snapshot.commissionCharges.map((charge) => charge.commissionAllocationId)].sort();
  if (chargeIds.length) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CommissionAllocation" WHERE "id" IN (${Prisma.join(chargeIds)}) ORDER BY "id" ASC FOR UPDATE`);
    if (locked.length !== chargeIds.length) throw new StoreEarningError("STORE_EARNING_COMMISSION_INVALID", "One or more commission allocations were not found.");
  }
  const allocations = chargeIds.length ? await tx.commissionAllocation.findMany({ where: { id: { in: chargeIds } }, include: { accrual: { select: { id: true, subjectId: true, status: true } } }, orderBy: { id: "asc" } }) : [];
  const allocationById = new Map(allocations.map((allocation) => [allocation.id, allocation]));
  for (const charge of snapshot.commissionCharges) {
    const allocation = allocationById.get(charge.commissionAllocationId);
    if (!allocation || allocation.publicReference !== charge.commissionAllocationPublicReference || allocation.currency !== "ZAR" || allocation.status !== "ACCRUED" || allocation.downstreamReleaseJournalId || allocation.accrual.status !== "ACCRUED" || (operationEvidence.commissionSubjectId && allocation.accrual.subjectId !== operationEvidence.commissionSubjectId)) throw new StoreEarningError("STORE_EARNING_COMMISSION_INVALID", "Commission charge is not related active allocation evidence for the store settlement.");
    const chargeAmount = new Prisma.Decimal(charge.amount);
    if (!allocation.storeAttributedAmount.add(chargeAmount).lessThanOrEqualTo(allocation.amount)) throw new StoreEarningError("STORE_EARNING_COMMISSION_OVER_ATTRIBUTED", "Commission allocation does not have enough unattributed value.");
  }
  const duplicate = await tx.storeEarning.findUnique({ where: { subjectType_subjectId_storeId_settlementVersion: { subjectType: snapshot.subjectType, subjectId: snapshot.subjectId, storeId: snapshot.storeId, settlementVersion: snapshot.settlementVersion } }, select: { id: true } });
  if (duplicate) throw new StoreEarningError("STORE_EARNING_SETTLEMENT_ALREADY_ACCRUED", "This subject, store and settlement version already has an earning.");
  const accounts = await resolveStoreEarningPayableAccountWithinTransaction(tx, { storeId: snapshot.storeId, walletId: snapshot.walletId, accountId: operationEvidence.payableAccountId });
  const held = await tx.ledgerAccount.findFirst({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  const amount = new Prisma.Decimal(snapshot.netStoreEarningAmount);
  if (!held || held.currentBalance.lessThan(amount)) throw new StoreEarningError("STORE_EARNING_INSUFFICIENT_HELD_FUNDS", "Customer funds held are insufficient for the store entitlement.");
  for (const charge of snapshot.commissionCharges) await tx.commissionAllocation.update({ where: { id: charge.commissionAllocationId }, data: { storeAttributedAmount: { increment: new Prisma.Decimal(charge.amount) } } });
  const earningReference = reference("SE");
  const journal = await postLedgerJournalWithinTransaction(tx, storeEarningAccrualPosting({ earningReference, amount: snapshot.netStoreEarningAmount, customerFundsHeldAccountId: held.id, storePayableAccountId: accounts.account.id, storePublicReference: snapshot.storePublicReference, subjectPublicReference: snapshot.subjectPublicReference, settlementVersion: snapshot.settlementVersion, paymentPublicReference: snapshot.paymentPublicReference, actorUserId: operationEvidence.actorUserId }));
  const created = await tx.storeEarning.create({ data: { publicReference: earningReference, storeId: snapshot.storeId, storePublicReference: snapshot.storePublicReference, walletId: snapshot.walletId, payableAccountId: accounts.account.id, subjectType: snapshot.subjectType, subjectId: snapshot.subjectId, subjectPublicReference: snapshot.subjectPublicReference, paymentId: snapshot.paymentId, paymentPublicReference: snapshot.paymentPublicReference, settlementReference: snapshot.settlementReference, settlementVersion: snapshot.settlementVersion, calculationVersion: snapshot.calculationVersion, authoritativeAt: new Date(snapshot.authoritativeAt), settlementBasisAmount: new Prisma.Decimal(snapshot.sellerSettlementBasisAmount), attributedCommissionAmount: new Prisma.Decimal(snapshot.attributedCommissionAmount), amount, currency: "ZAR", status: "ACCRUED", creationIdempotencyKey: operationEvidence.operationId, creationRequestHash: calculationHash, calculationHash, accrualLedgerJournalId: journal.id, commissionCharges: { create: snapshot.commissionCharges.map((charge) => ({ publicReference: reference("SEC"), commissionAllocationId: charge.commissionAllocationId, amount: new Prisma.Decimal(charge.amount), currency: "ZAR" })) }, statusHistory: { create: [{ fromStatus: null, toStatus: "ACCRUED", actorType: operationEvidence.actorUserId ? "USER" : "SYSTEM", actorId: operationEvidence.actorUserId ?? null, reasonCode: "ACCRUAL_POSTED", safeMetadata: { ledgerReference: journal.reference, settlementReference: snapshot.settlementReference } }, { fromStatus: null, toStatus: "ACCRUED", actorType: "SYSTEM", reasonCode: "COMMISSION_CHARGES_ATTRIBUTED", safeMetadata: { chargeCount: String(snapshot.commissionCharges.length) } }] } }, include });
  return Object.freeze({ ...internalDto(created), replayed: false });
}

export async function accrueStoreEarning(command: StoreEarningAccrualCommand, options?: Readonly<{ allowTestOnlyBypass?: boolean }>) {
  assertStoreEarningsProductionReady(options);
  const snapshot = validateStoreSettlementSnapshot(command.snapshot);
  const store = await prisma.store.findUnique({ where: { id: snapshot.storeId }, select: { id: true, status: true } });
  if (!store || store.status !== "ACTIVE") throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "An active canonical store is required for store earning accrual.");
  const provisioned = await ensureStoreEarningPayableAccount(store.id);
  if (provisioned.wallet.id !== snapshot.walletId) throw new StoreEarningError("STORE_EARNING_ACCOUNT_INVALID", "Authoritative settlement wallet does not match the canonical store wallet.");
  const evidence = snapshot.commissionCharges.map((charge) => ({ id: charge.commissionAllocationId, publicReference: charge.commissionAllocationPublicReference, amount: charge.amount, currency: "ZAR" as const }));
  const run = () => prisma.$transaction((tx) => accrueStoreEarningInTransaction(tx, snapshot, evidence, { operationId: command.operationId, actorUserId: command.actorUserId, payableAccountId: provisioned.account.id }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  try { return await withLedgerRetry(run); }
  catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const winner = await prisma.storeEarning.findUnique({ where: { creationIdempotencyKey: command.operationId }, include });
      if (winner) return Object.freeze({ ...internalDto(winner), replayed: true });
    }
    throw error;
  }
}
