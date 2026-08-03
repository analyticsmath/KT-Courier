import { Decimal } from "@prisma/client/runtime/library";

export type DiscountScope = "LINE" | "ORDER" | "DELIVERY";
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface DiscountPolicyInput {
  scope: DiscountScope;
  type: DiscountType;
  value: Decimal; // percentage in bps (e.g. 1000 = 10%) or fixed ZAR amount
  basisAmount: Decimal;
  maximumDiscountAmount?: Decimal;
}

export function calculateDiscountAmount(input: DiscountPolicyInput): Decimal {
  if (input.basisAmount.lessThanOrEqualTo(0)) {
    return new Decimal(0);
  }

  let discountAmount = new Decimal(0);

  if (input.type === "PERCENTAGE") {
    if (input.value.lessThanOrEqualTo(0) || input.value.greaterThan(10000)) {
      throw new Error("Percentage discount value must be between 0 and 10000 bps.");
    }
    // value is in bps, so divide by 10000
    const fraction = input.value.dividedBy(10000);
    discountAmount = input.basisAmount.times(fraction);
  } else if (input.type === "FIXED_AMOUNT") {
    if (input.value.lessThanOrEqualTo(0)) {
      throw new Error("Fixed amount discount must be positive.");
    }
    discountAmount = input.value;
  }

  if (input.maximumDiscountAmount && discountAmount.greaterThan(input.maximumDiscountAmount)) {
    discountAmount = input.maximumDiscountAmount;
  }

  // Discount cannot make the basis negative
  if (discountAmount.greaterThan(input.basisAmount)) {
    discountAmount = input.basisAmount;
  }

  // Ensure 2 decimal places for ZAR
  return discountAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
}
