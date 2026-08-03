import { Prisma } from "@prisma/client";
import { RefundError } from "./errors";
import { isReservedRefundStatus } from "./refund-state-machine";

export type RefundAmountEvidence = Readonly<{ amount: string | Prisma.Decimal; status: string }>;

function decimal(value: string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? new Prisma.Decimal(value) : new Prisma.Decimal(value);
}

export function calculateRemainingRefundableAmount(
  paymentAmount: string | Prisma.Decimal,
  refunds: readonly RefundAmountEvidence[],
): Prisma.Decimal {
  const gross = decimal(paymentAmount);
  if (!gross.isFinite() || gross.lessThanOrEqualTo(0) || gross.decimalPlaces() > 2) {
    throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Payment amount is not valid refund evidence.");
  }
  let consumed = new Prisma.Decimal(0);
  for (const refund of refunds) {
    if (refund.status === "SUCCEEDED" || isReservedRefundStatus(refund.status)) {
      const amount = decimal(refund.amount);
      if (!amount.isFinite() || amount.lessThanOrEqualTo(0) || amount.decimalPlaces() > 2) {
        throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund evidence contains an invalid amount.");
      }
      consumed = consumed.add(amount);
    }
  }
  const remaining = gross.sub(consumed);
  if (remaining.isNegative()) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Refund evidence exceeds the original payment amount.");
  }
  return remaining.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function assertRefundWithinRemaining(requested: Prisma.Decimal, remaining: Prisma.Decimal): void {
  if (requested.greaterThan(remaining)) {
    throw new RefundError("REFUND_AMOUNT_EXCEEDS_REMAINING", "Requested refund exceeds the remaining refundable amount.");
  }
}

