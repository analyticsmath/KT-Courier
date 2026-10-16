import { describe, expect, it } from "vitest";
import { subscriptionMoney, subscriptionAmount, boundedSubscriptionDiscount } from "@/lib/subscriptions/money";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { Prisma } from "@prisma/client";

describe("Subscription Money & Formatting Invariants Integration Tests", () => {
  it("enforces positive ZAR amounts with at most two decimal places", () => {
    const valid = subscriptionMoney("199.99");
    expect(valid).toBeInstanceOf(Prisma.Decimal);
    expect(valid.toFixed(2)).toBe("199.99");

    expect(() => subscriptionMoney("-10.00")).toThrowError(SubscriptionError);
    expect(() => subscriptionMoney("0.00")).toThrowError(SubscriptionError);
    expect(() => subscriptionMoney("10.999")).toThrowError(SubscriptionError);
    expect(() => subscriptionMoney("not-a-number")).toThrowError();
  });

  it("formats subscription amounts to standard two-decimal string", () => {
    expect(subscriptionAmount("150")).toBe("150.00");
    expect(subscriptionAmount(new Prisma.Decimal("299.50"))).toBe("299.50");
  });

  it("bounds discount so it cannot exceed base price or be negative", () => {
    const base = "100.00";
    expect(boundedSubscriptionDiscount(base, "40.00").toFixed(2)).toBe("40.00");
    expect(boundedSubscriptionDiscount(base, "150.00").toFixed(2)).toBe("100.00"); // capped at 100

    expect(() => boundedSubscriptionDiscount(base, "-5.00")).toThrowError(SubscriptionError);
  });
});
