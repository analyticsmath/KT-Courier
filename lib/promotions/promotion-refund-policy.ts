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
  // Customer paid amount is line total minus platform subsidies
  // Store funded discounts were already deducted from line total in the customer's view
  const customerPaidTotal = context.lineTotal.minus(context.platformFundedDiscount);

  const customerRefundAmount = customerPaidTotal.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  const platformSubventionReversal = context.platformFundedDiscount.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  const storeBasisReversal = context.storeFundedDiscount.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

  return {
    customerRefundAmount,
    platformSubventionReversal,
    storeBasisReversal
  };
}
