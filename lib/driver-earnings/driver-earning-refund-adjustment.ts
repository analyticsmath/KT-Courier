import { Prisma } from "@prisma/client";
import { DriverEarningError } from "./errors";
import { formatDriverEarningMoney, parseDriverEarningMoney } from "./driver-earning-money";

export type DriverEarningRefundSnapshot = Readonly<{
  driverEarningId: string; driverEarningPublicReference: string; refundId: string; refundPublicReference: string;
  refundableDriverBasisAmount: string; cumulativeDriverRefundAmount: string; priorDriverRefundReservedOrCompletedAmount: string;
  desiredCumulativeDriverEarningAdjustment: string; currentDriverEarningAdjustment: string;
  assignmentReference: string; settlementVersion: string; refundAllocationVersion: string;
}>;

export function calculateDriverEarningRefundAdjustment(input: Readonly<{ originalDriverEarningAmount: string; refundableDriverBasisAmount: string; cumulativeDriverRefundAmount: string; priorDriverEarningAdjustment: string }>): Readonly<{ desiredCumulativeAdjustment: string; currentAdjustment: string }> {
  const earning = parseDriverEarningMoney(input.originalDriverEarningAmount);
  const basis = parseDriverEarningMoney(input.refundableDriverBasisAmount);
  const cumulative = parseDriverEarningMoney(input.cumulativeDriverRefundAmount, { allowZero: true });
  const prior = parseDriverEarningMoney(input.priorDriverEarningAdjustment, { allowZero: true });
  if (cumulative.greaterThan(basis)) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Cumulative driver refund exceeds its authoritative basis.");
  const desired = cumulative.equals(basis) ? earning : earning.mul(cumulative).div(basis).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const current = desired.sub(prior);
  if (current.isNegative() || desired.greaterThan(earning)) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Cumulative driver refund adjustment is incoherent.");
  return Object.freeze({ desiredCumulativeAdjustment: formatDriverEarningMoney(desired), currentAdjustment: formatDriverEarningMoney(current) });
}

export function validateDriverEarningRefundSnapshot(snapshot: DriverEarningRefundSnapshot, originalDriverEarningAmount: string): DriverEarningRefundSnapshot {
  const refs = [snapshot.driverEarningId, snapshot.driverEarningPublicReference, snapshot.refundId, snapshot.refundPublicReference, snapshot.assignmentReference, snapshot.settlementVersion, snapshot.refundAllocationVersion];
  if (!refs.every((value) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value))) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Authoritative driver refund identity is invalid.");
  const result = calculateDriverEarningRefundAdjustment({ originalDriverEarningAmount, refundableDriverBasisAmount: snapshot.refundableDriverBasisAmount, cumulativeDriverRefundAmount: snapshot.cumulativeDriverRefundAmount, priorDriverEarningAdjustment: snapshot.priorDriverRefundReservedOrCompletedAmount });
  if (formatDriverEarningMoney(parseDriverEarningMoney(snapshot.desiredCumulativeDriverEarningAdjustment, { allowZero: true })) !== result.desiredCumulativeAdjustment || formatDriverEarningMoney(parseDriverEarningMoney(snapshot.currentDriverEarningAdjustment, { allowZero: true })) !== result.currentAdjustment) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Driver refund snapshot does not match the cumulative Decimal calculation.");
  return Object.freeze({ ...snapshot, refundableDriverBasisAmount: formatDriverEarningMoney(parseDriverEarningMoney(snapshot.refundableDriverBasisAmount)), cumulativeDriverRefundAmount: formatDriverEarningMoney(parseDriverEarningMoney(snapshot.cumulativeDriverRefundAmount, { allowZero: true })), priorDriverRefundReservedOrCompletedAmount: formatDriverEarningMoney(parseDriverEarningMoney(snapshot.priorDriverRefundReservedOrCompletedAmount, { allowZero: true })), desiredCumulativeDriverEarningAdjustment: result.desiredCumulativeAdjustment, currentDriverEarningAdjustment: result.currentAdjustment });
}
