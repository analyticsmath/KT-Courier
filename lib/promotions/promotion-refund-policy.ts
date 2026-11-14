import { Decimal } from "@prisma/client/runtime/library";

export type PromotionRedemptionReusePolicy = "REUSABLE" | "CONSUMED";

export interface RefundAllocationContext {
  lineTotal: Decimal;
  platformFundedDiscount: Decimal;
  storeFundedDiscount: Decimal;
  refundProportion: Decimal; // 0.0 to 1.0 for partial refunds
}

export interface RefundAllocationResult {
  customerRefundAmount: Decimal;
  platformSubventionReversal: Decimal;
  storeBasisReversal: Decimal;
}

export function calculateRefundAllocations(context: RefundAllocationContext): RefundAllocationResult {
  const { lineTotal, platformFundedDiscount, storeFundedDiscount, refundProportion } = context;
  if ([lineTotal, platformFundedDiscount, storeFundedDiscount, refundProportion].some(value => !value.isFinite() || value.isNegative()) || refundProportion.greaterThan(1) || platformFundedDiscount.plus(storeFundedDiscount).greaterThan(lineTotal)) throw new Error("Invalid promotion refund amounts.");
  // The customer paid the line price less both sources of the discount.
  const customerPaidTotal = lineTotal.minus(platformFundedDiscount).minus(storeFundedDiscount);

  const customerRefundAmount = customerPaidTotal.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  const platformSubventionReversal = context.platformFundedDiscount.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  const storeBasisReversal = context.storeFundedDiscount.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  return {
    customerRefundAmount,
    platformSubventionReversal,
    storeBasisReversal
  };
}
