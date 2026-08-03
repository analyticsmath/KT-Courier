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
