import { StoreOrderError } from "@/lib/store-orders/errors";

/** Integer cents prevent independently rounded partial refunds. */
export function cents(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new StoreOrderError("STORE_ORDER_MONEY_INVALID", "An exact non-negative money amount is required.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

export function money(value: bigint): string {
  if (value < BigInt(0)) throw new StoreOrderError("STORE_ORDER_MONEY_INVALID", "Negative allocation is not allowed.");
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}

export function cumulativeLineAllocation(input: Readonly<{ totalAmount: string; originalQuantity: number; previouslyResolvedQuantity: number; resolvedQuantityAfter: number }>): string {
  const { originalQuantity, previouslyResolvedQuantity, resolvedQuantityAfter } = input;
  if (!Number.isSafeInteger(originalQuantity) || originalQuantity <= 0 || !Number.isSafeInteger(previouslyResolvedQuantity) || !Number.isSafeInteger(resolvedQuantityAfter) || previouslyResolvedQuantity < 0 || resolvedQuantityAfter < previouslyResolvedQuantity || resolvedQuantityAfter > originalQuantity) {
    throw new StoreOrderError("STORE_ORDER_QUANTITY_INVALID", "Resolved quantity is outside the immutable order quantity.");
  }
  const total = cents(input.totalAmount);
  const before = total * BigInt(previouslyResolvedQuantity) / BigInt(originalQuantity);
  const after = total * BigInt(resolvedQuantityAfter) / BigInt(originalQuantity);
  return money(after - before);
}

export function assertSubstitutionPriceCap(input: Readonly<{ substituteCharge: string; originalRemainingCharge: string }>): void {
  if (cents(input.substituteCharge) > cents(input.originalRemainingCharge)) throw new StoreOrderError("STORE_ORDER_SUBSTITUTION_PRICE_CAP", "A substitute cannot cost more than the remaining paid amount.");
}

/** Use the immutable line's cumulative refunded value, including price
 * differences, rather than reversing the whole substituted quantity. */
export function frozenRefundAllocation(input: Readonly<{ sellerBasis: string; commission: string; storeEarning: string; includedTax: string; priorRefund: string; refund: string }>) {
  const basis = cents(input.sellerBasis), commission = cents(input.commission), earning = cents(input.storeEarning), tax = cents(input.includedTax), prior = cents(input.priorRefund), delta = cents(input.refund);
  if (commission + earning !== basis || prior + delta > basis || tax > basis) throw new StoreOrderError("STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "Frozen line refund exceeds its immutable financial evidence.");
  if (basis === BigInt(0)) return { SELLER_BASIS: "0.00", COMMISSION: "0.00", STORE_EARNING: "0.00", taxAmount: "0.00" };
  const commissionDelta = commission * (prior + delta) / basis - commission * prior / basis;
  const taxDelta = tax * (prior + delta) / basis - tax * prior / basis;
  return { SELLER_BASIS: money(delta), COMMISSION: money(commissionDelta), STORE_EARNING: money(delta - commissionDelta), taxAmount: money(taxDelta) };
}
