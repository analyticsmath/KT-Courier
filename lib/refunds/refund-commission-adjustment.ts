import { Prisma } from "@prisma/client";
import { RefundError } from "./errors";

export type RefundableCommissionAllocation = Readonly<{
  id: string;
  publicReference: string;
  accrualId: string;
  allocationType: "PLATFORM_COMMISSION_REVENUE" | "BENEFICIARY_COMMISSION_PAYABLE";
  ledgerAccountId: string;
  amount: string | Prisma.Decimal;
  previouslyAdjustedAmount: string | Prisma.Decimal;
  status: string;
  downstreamReleaseJournalId: string | null;
}>;

export type CommissionAdjustmentDelta = Readonly<{
  commissionAllocationId: string;
  commissionAllocationReference: string;
  commissionAccrualId: string;
  ledgerAccountId: string;
  sourceType: "PLATFORM_COMMISSION_REVENUE" | "BENEFICIARY_COMMISSION_PAYABLE";
  originalAmount: string;
  desiredCumulativeAmount: string;
  previousCumulativeAmount: string;
  amount: string;
}>;

function exact(value: string | Prisma.Decimal): Prisma.Decimal {
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.isNegative() || result.decimalPlaces() > 2) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Commission adjustment evidence is invalid.");
  }
  return result;
}

export function calculateCumulativeCommissionAdjustments(input: Readonly<{
  originalPaymentAmount: string | Prisma.Decimal;
  priorSuccessfulAndReservedRefundAmount: string | Prisma.Decimal;
  currentRefundAmount: string | Prisma.Decimal;
  allocations: readonly RefundableCommissionAllocation[];
}>): readonly CommissionAdjustmentDelta[] {
  const payment = exact(input.originalPaymentAmount);
  const prior = exact(input.priorSuccessfulAndReservedRefundAmount);
  const current = exact(input.currentRefundAmount);
  if (payment.isZero() || current.isZero() || prior.add(current).greaterThan(payment)) {
    throw new RefundError("REFUND_AMOUNT_EXCEEDS_REMAINING", "Cumulative refund amount is outside the original payment amount.");
  }
  const cumulative = prior.add(current);
  const isFinal = cumulative.equals(payment);
  const deltas: CommissionAdjustmentDelta[] = [];

  for (const allocation of input.allocations) {
    if (allocation.status === "RELEASED" || allocation.downstreamReleaseJournalId) {
      throw new RefundError("REFUND_COMMISSION_RELEASED", "A downstream-released commission allocation cannot be reserved automatically.");
    }
    if (allocation.status !== "ACCRUED") continue;
    const original = exact(allocation.amount);
    const previous = exact(allocation.previouslyAdjustedAmount);
    const desired = isFinal
      ? original
      : original.mul(cumulative).div(payment).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const delta = desired.sub(previous);
    const remaining = original.sub(previous);
    if (delta.isNegative() || delta.greaterThan(remaining)) {
      throw new RefundError("REFUND_LEDGER_INCOHERENT", "Cumulative commission adjustment is incoherent.");
    }
    if (delta.isZero()) continue;
    deltas.push(Object.freeze({
      commissionAllocationId: allocation.id,
      commissionAllocationReference: allocation.publicReference,
      commissionAccrualId: allocation.accrualId,
      ledgerAccountId: allocation.ledgerAccountId,
      sourceType: allocation.allocationType,
      originalAmount: original.toFixed(2),
      desiredCumulativeAmount: desired.toFixed(2),
      previousCumulativeAmount: previous.toFixed(2),
      amount: delta.toFixed(2),
    }));
  }
  return Object.freeze(deltas);
}
