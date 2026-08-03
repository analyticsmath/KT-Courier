import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { StoreEarningError } from "@/lib/store-earnings/errors";
import { RefundError } from "@/lib/refunds/errors";
import { formatStoreEarningMoney } from "@/lib/store-earnings/store-earning-money";
import { validateStoreEarningRefundSnapshot, type StoreEarningRefundSnapshot } from "@/lib/store-earnings/store-earning-refund-adjustment";
import { openStoreEarningReconciliationWithinTransaction } from "./store-earning-reconciliation.service";

const fundingReference = () => `RFA-${randomUUID().replaceAll("-", "").toUpperCase()}`;

export type PreparedStoreEarningRefundFunding = Readonly<{
  blocked: false;
  publicReference: string;
  sourceType: "STORE_EARNINGS_PAYABLE";
  ledgerAccountId: string;
  commissionAccrualId: null;
  commissionAllocationId: null;
  commissionAllocationReference: null;
  storeEarningId: string;
  storeEarningPublicReference: string;
  amount: string;
}>;

export type BlockedStoreEarningRefundFunding = Readonly<{
  blocked: true;
  storeEarningId: string;
  storeEarningPublicReference: string;
  blockReason: "REFUND_AFTER_RELEASE";
}>;

export async function assertGenericRefundHasNoStoreEarningExposure(tx: Prisma.TransactionClient, paymentId: string): Promise<void> {
  const earnings = await tx.storeEarning.findMany({ where: { paymentId, status: { in: ["ACCRUED", "RELEASED", "RECONCILIATION_REQUIRED"] } }, select: { amount: true, refundedAmount: true, releasedAmount: true, reversedAmount: true } });
  if (earnings.some((earning) => earning.amount.sub(earning.refundedAmount).sub(earning.releasedAmount).sub(earning.reversedAmount).greaterThan(0))) {
    throw new RefundError("REFUND_FUNDING_UNAVAILABLE", "An authoritative store-level refund snapshot is required before reserving store settlement proceeds.");
  }
}

export async function prepareStoreEarningRefundFundingWithinTransaction(tx: Prisma.TransactionClient, snapshotInput: StoreEarningRefundSnapshot) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" = ${snapshotInput.storeEarningId} FOR UPDATE`);
  if (locked.length !== 1) throw new StoreEarningError("STORE_EARNING_NOT_FOUND", "Store earning was not found for authoritative refund allocation.");
  const earning = await tx.storeEarning.findUnique({ where: { id: snapshotInput.storeEarningId }, include: { payableAccount: true } });
  if (!earning || earning.publicReference !== snapshotInput.storeEarningPublicReference || earning.settlementVersion !== snapshotInput.settlementVersion) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store refund snapshot does not match immutable earning evidence.");
  const snapshot = validateStoreEarningRefundSnapshot(snapshotInput, formatStoreEarningMoney(earning.amount));
  if (earning.status === "RELEASED" || earning.releaseLedgerJournalId) {
    await openStoreEarningReconciliationWithinTransaction(tx, { caseKey: `store-earning:refund-after-release:${earning.id}:${snapshot.refundId}`, storeEarningId: earning.id, refundId: snapshot.refundId, reason: "REFUND_AFTER_RELEASE", priority: "CRITICAL", safeSummary: "Released store earnings cannot fund an automatic refund or be clawed back from owner-withdrawable." });
    return Object.freeze({ blocked: true as const, storeEarningId: earning.id, storeEarningPublicReference: earning.publicReference, blockReason: "REFUND_AFTER_RELEASE" as const });
  }
  if (earning.status !== "ACCRUED" || earning.reversalLedgerJournalId) throw new StoreEarningError("STORE_EARNING_INVALID_STATE", "Store earning is not available for refund reservation.");
  const prior = earning.refundReservedAmount.add(earning.refundedAmount);
  if (!prior.equals(snapshot.priorStoreRefundReservedOrCompletedAmount)) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store refund snapshot prior adjustment does not match stored projections.");
  const amount = new Prisma.Decimal(snapshot.currentStoreEarningAdjustment);
  const remaining = earning.amount.sub(earning.refundReservedAmount).sub(earning.refundedAmount).sub(earning.releasedAmount).sub(earning.reversedAmount);
  if (!amount.greaterThan(0) || amount.greaterThan(remaining) || earning.payableAccount.currentBalance.lessThan(amount)) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store refund adjustment exceeds the remaining payable entitlement.");
  return Object.freeze({ blocked: false as const, publicReference: fundingReference(), sourceType: "STORE_EARNINGS_PAYABLE" as const, ledgerAccountId: earning.payableAccountId, commissionAccrualId: null, commissionAllocationId: null, commissionAllocationReference: null, storeEarningId: earning.id, storeEarningPublicReference: earning.publicReference, amount: formatStoreEarningMoney(amount) });
}

export async function applyStoreEarningRefundReservationWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ refundId: string; funding: PreparedStoreEarningRefundFunding; actorUserId?: string }>) {
  const amount = new Prisma.Decimal(input.funding.amount);
  await tx.refundFundingAllocation.create({ data: { publicReference: input.funding.publicReference, refundId: input.refundId, sourceType: "STORE_EARNINGS_PAYABLE", ledgerAccountId: input.funding.ledgerAccountId, storeEarningId: input.funding.storeEarningId, amount, currency: "ZAR" } });
  await tx.storeEarning.update({ where: { id: input.funding.storeEarningId }, data: { refundReservedAmount: { increment: amount }, version: { increment: 1 }, statusHistory: { create: { fromStatus: "ACCRUED", toStatus: "ACCRUED", actorType: input.actorUserId ? "USER" : "SYSTEM", actorId: input.actorUserId ?? null, reasonCode: "REFUND_AMOUNT_RESERVED", safeMetadata: { refundId: input.refundId, amount: input.funding.amount } } } } });
}

async function groupedStoreFunding(tx: Prisma.TransactionClient, refundId: string) {
  const allocations = await tx.refundFundingAllocation.findMany({ where: { refundId, sourceType: "STORE_EARNINGS_PAYABLE", storeEarningId: { not: null } }, select: { storeEarningId: true, amount: true }, orderBy: { storeEarningId: "asc" } });
  const grouped = new Map<string, Prisma.Decimal>();
  for (const item of allocations) if (item.storeEarningId) grouped.set(item.storeEarningId, (grouped.get(item.storeEarningId) ?? new Prisma.Decimal(0)).add(item.amount));
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export async function releaseStoreEarningRefundReservationsWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ refundId: string; refundPublicReference: string; actorUserId?: string }>) {
  const grouped = await groupedStoreFunding(tx, input.refundId);
  for (const [earningId, amount] of grouped) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" = ${earningId} FOR UPDATE`);
    const earning = await tx.storeEarning.findUnique({ where: { id: earningId } });
    if (!earning || earning.refundReservedAmount.lessThan(amount)) throw new StoreEarningError("STORE_EARNING_RECONCILIATION_REQUIRED", "Store earning refund reservation release does not match stored projections.");
    await tx.storeEarning.update({ where: { id: earning.id }, data: { refundReservedAmount: { decrement: amount }, version: { increment: 1 }, statusHistory: { create: { fromStatus: earning.status, toStatus: earning.status, actorType: input.actorUserId ? "USER" : "SYSTEM", actorId: input.actorUserId ?? null, reasonCode: "REFUND_RESERVATION_RELEASED", safeMetadata: { refundReference: input.refundPublicReference, amount: formatStoreEarningMoney(amount) } } } } });
  }
}

export async function completeStoreEarningRefundProjectionsWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ refundId: string; refundPublicReference: string; actorUserId?: string }>) {
  const grouped = await groupedStoreFunding(tx, input.refundId);
  for (const [earningId, amount] of grouped) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "StoreEarning" WHERE "id" = ${earningId} FOR UPDATE`);
    const earning = await tx.storeEarning.findUnique({ where: { id: earningId } });
    if (!earning || earning.refundReservedAmount.lessThan(amount) || earning.releaseLedgerJournalId || !earning.releasedAmount.isZero()) throw new StoreEarningError("STORE_EARNING_RECONCILIATION_REQUIRED", "Store earning refund completion conflicts with release or reservation evidence.");
    const refunded = earning.refundedAmount.add(amount);
    const fullyRefunded = refunded.equals(earning.amount) && earning.reversedAmount.isZero();
    await tx.storeEarning.update({ where: { id: earning.id }, data: { refundReservedAmount: { decrement: amount }, refundedAmount: { increment: amount }, status: fullyRefunded ? "FULLY_REFUNDED" : earning.status, version: { increment: 1 }, statusHistory: { create: { fromStatus: earning.status, toStatus: fullyRefunded ? "FULLY_REFUNDED" : earning.status, actorType: input.actorUserId ? "USER" : "SYSTEM", actorId: input.actorUserId ?? null, reasonCode: "REFUND_COMPLETED", safeMetadata: { refundReference: input.refundPublicReference, amount: formatStoreEarningMoney(amount) } } } } });
  }
}
