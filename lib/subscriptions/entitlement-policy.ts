import { Prisma } from "@prisma/client";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { boundedSubscriptionDiscount } from "@/lib/subscriptions/money";

export type EntitlementUsageAction = "RESERVE" | "CONSUME" | "RELEASE" | "REVERSE" | "EXPIRE" | "REVOKE";

export function assertEntitlementUsage(input: Readonly<{ action: EntitlementUsageAction; amount?: string | null; quantity?: number | null; remainingAmount?: string | null; remainingQuantity?: number | null }>): void {
  const hasAmount = input.amount !== undefined && input.amount !== null;
  const hasQuantity = input.quantity !== undefined && input.quantity !== null;
  if (!hasAmount && !hasQuantity && !["EXPIRE", "REVOKE"].includes(input.action)) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Entitlement usage must state an amount or quantity.");
  if (hasAmount && (new Prisma.Decimal(input.amount!).lessThan(0) || new Prisma.Decimal(input.amount!).greaterThan(input.remainingAmount ?? "0"))) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_EXHAUSTED", "Entitlement amount exceeds its remaining allowance.");
  if (hasQuantity && (!Number.isSafeInteger(input.quantity) || input.quantity! < 0 || input.quantity! > (input.remainingQuantity ?? 0))) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_EXHAUSTED", "Entitlement quantity exceeds its remaining allowance.");
}

export function resolveDeliveryFeeSubscriptionAdjustment(input: Readonly<{ baseDeliveryFee: string; benefitType: "DELIVERY_FEE_PERCENT_REDUCTION" | "DELIVERY_FEE_FIXED_REDUCTION" | "DELIVERY_FEE_PERIOD_ALLOWANCE" | "INCLUDED_ELIGIBLE_DELIVERY_COUNT"; amount?: string | null; remainingAmount?: string | null; remainingQuantity?: number | null }>): Readonly<{ adjustment: string; finalDeliveryFee: string }> {
  const base = new Prisma.Decimal(input.baseDeliveryFee);
  if (!base.isFinite() || base.lessThan(0)) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Authoritative delivery fee is invalid.");
  let requested = new Prisma.Decimal(0);
  if (input.benefitType === "DELIVERY_FEE_PERCENT_REDUCTION") requested = base.mul(new Prisma.Decimal(input.amount ?? "0")).div(100);
  if (input.benefitType === "DELIVERY_FEE_FIXED_REDUCTION" || input.benefitType === "DELIVERY_FEE_PERIOD_ALLOWANCE") requested = new Prisma.Decimal(input.amount ?? "0");
  if (input.benefitType === "INCLUDED_ELIGIBLE_DELIVERY_COUNT" && (input.remainingQuantity ?? 0) > 0) requested = base;
  if (input.remainingAmount) requested = Prisma.Decimal.min(requested, new Prisma.Decimal(input.remainingAmount));
  const adjustment = boundedSubscriptionDiscount(base, requested);
  return Object.freeze({ adjustment: adjustment.toFixed(2), finalDeliveryFee: base.minus(adjustment).toFixed(2) });
}
