import { Prisma } from "@prisma/client";
import { StoreEarningError } from "./errors";
import { formatStoreEarningMoney, parseStoreEarningMoney } from "./store-earning-money";

export type StoreEarningRefundSnapshot = Readonly<{
  storeEarningId: string;
  storeEarningPublicReference: string;
  refundId: string;
  refundPublicReference: string;
  refundableStoreBasisAmount: string;
  cumulativeStoreRefundAmount: string;
  priorStoreRefundReservedOrCompletedAmount: string;
  desiredCumulativeStoreEarningAdjustment: string;
  currentStoreEarningAdjustment: string;
  settlementVersion: string;
  refundAllocationVersion: string;
}>;

export function calculateStoreEarningRefundAdjustment(input: Readonly<{
  originalStoreEarningAmount: string;
  refundableStoreBasisAmount: string;
  cumulativeStoreRefundAmount: string;
  priorStoreEarningAdjustment: string;
}>): Readonly<{ desiredCumulativeAdjustment: string; currentAdjustment: string }> {
  const earning = parseStoreEarningMoney(input.originalStoreEarningAmount);
  const basis = parseStoreEarningMoney(input.refundableStoreBasisAmount);
  const cumulativeRefund = parseStoreEarningMoney(input.cumulativeStoreRefundAmount, { allowZero: true });
  const prior = parseStoreEarningMoney(input.priorStoreEarningAdjustment, { allowZero: true });
  if (cumulativeRefund.greaterThan(basis)) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Cumulative store refund exceeds the authoritative store basis.");
  const desired = cumulativeRefund.equals(basis)
    ? earning
    : earning.mul(cumulativeRefund).div(basis).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const current = desired.sub(prior);
  if (current.isNegative() || desired.greaterThan(earning)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Cumulative store earning refund adjustment is incoherent.");
  }
  return Object.freeze({ desiredCumulativeAdjustment: formatStoreEarningMoney(desired), currentAdjustment: formatStoreEarningMoney(current) });
}

export function validateStoreEarningRefundSnapshot(snapshot: StoreEarningRefundSnapshot, originalStoreEarningAmount: string): StoreEarningRefundSnapshot {
  const refs = [snapshot.storeEarningId, snapshot.storeEarningPublicReference, snapshot.refundId, snapshot.refundPublicReference, snapshot.settlementVersion, snapshot.refundAllocationVersion];
  if (refs.some((value) => !value.trim() || value.length > 160)) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Authoritative store refund identity is invalid.");
  const calculation = calculateStoreEarningRefundAdjustment({
    originalStoreEarningAmount,
    refundableStoreBasisAmount: snapshot.refundableStoreBasisAmount,
    cumulativeStoreRefundAmount: snapshot.cumulativeStoreRefundAmount,
    priorStoreEarningAdjustment: snapshot.priorStoreRefundReservedOrCompletedAmount,
  });
  const desired = formatStoreEarningMoney(parseStoreEarningMoney(snapshot.desiredCumulativeStoreEarningAdjustment, { allowZero: true }));
  const current = formatStoreEarningMoney(parseStoreEarningMoney(snapshot.currentStoreEarningAdjustment, { allowZero: true }));
  if (desired !== calculation.desiredCumulativeAdjustment || current !== calculation.currentAdjustment) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Authoritative store refund adjustment does not match the cumulative Decimal calculation.");
  return Object.freeze({ ...snapshot, refundableStoreBasisAmount: formatStoreEarningMoney(parseStoreEarningMoney(snapshot.refundableStoreBasisAmount)), cumulativeStoreRefundAmount: formatStoreEarningMoney(parseStoreEarningMoney(snapshot.cumulativeStoreRefundAmount, { allowZero: true })), priorStoreRefundReservedOrCompletedAmount: formatStoreEarningMoney(parseStoreEarningMoney(snapshot.priorStoreRefundReservedOrCompletedAmount, { allowZero: true })), desiredCumulativeStoreEarningAdjustment: desired, currentStoreEarningAdjustment: current });
}
