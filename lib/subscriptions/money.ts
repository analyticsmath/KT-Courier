import { Prisma } from "@prisma/client";
import { SubscriptionError } from "@/lib/subscriptions/errors";

export function subscriptionMoney(value: string | Prisma.Decimal): Prisma.Decimal {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.decimalPlaces() > 2 || amount.lessThanOrEqualTo(0)) {
    throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Subscription amounts must be positive ZAR amounts with at most two decimals.");
  }
  return amount;
}

export function subscriptionAmount(value: string | Prisma.Decimal): string {
  return subscriptionMoney(value).toFixed(2);
}

export function boundedSubscriptionDiscount(base: string | Prisma.Decimal, requested: string | Prisma.Decimal): Prisma.Decimal {
  const baseAmount = subscriptionMoney(base);
  const adjustment = new Prisma.Decimal(requested);
  if (!adjustment.isFinite() || adjustment.lessThan(0)) throw new SubscriptionError("SUBSCRIPTION_ENTITLEMENT_INVALID", "Subscription adjustment is invalid.");
  return Prisma.Decimal.min(baseAmount, adjustment);
}
