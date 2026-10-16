import { describe, expect, it } from "vitest";
import { assertEntitlementUsage } from "@/lib/subscriptions/entitlement-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Entitlement Usage Domain Integration Tests", () => {
  it("allows valid amount usage within remaining balance", () => {
    expect(() =>
      assertEntitlementUsage({
        action: "CONSUME",
        amount: "50.00",
        remainingAmount: "100.00",
      })
    ).not.toThrow();
  });

  it("throws SUBSCRIPTION_ENTITLEMENT_EXHAUSTED when amount exceeds remaining balance", () => {
    expect(() =>
      assertEntitlementUsage({
        action: "CONSUME",
        amount: "150.00",
        remainingAmount: "100.00",
      })
    ).toThrowError(SubscriptionError);
  });

  it("allows valid quantity usage within remaining count", () => {
    expect(() =>
      assertEntitlementUsage({
        action: "RESERVE",
        quantity: 2,
        remainingQuantity: 5,
      })
    ).not.toThrow();
  });

  it("throws SUBSCRIPTION_ENTITLEMENT_EXHAUSTED when quantity exceeds remaining count", () => {
    expect(() =>
      assertEntitlementUsage({
        action: "RESERVE",
        quantity: 6,
        remainingQuantity: 5,
      })
    ).toThrowError(SubscriptionError);
  });

  it("permits EXPIRE and REVOKE actions without amount or quantity", () => {
    expect(() => assertEntitlementUsage({ action: "EXPIRE" })).not.toThrow();
    expect(() => assertEntitlementUsage({ action: "REVOKE" })).not.toThrow();
  });
});
