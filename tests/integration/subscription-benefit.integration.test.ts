import { describe, expect, it } from "vitest";
import { resolveDeliveryFeeSubscriptionAdjustment } from "@/lib/subscriptions/entitlement-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Benefit Domain Integration Tests", () => {
  it("calculates percentage delivery fee reduction correctly", () => {
    const result = resolveDeliveryFeeSubscriptionAdjustment({
      baseDeliveryFee: "100.00",
      benefitType: "DELIVERY_FEE_PERCENT_REDUCTION",
      amount: "20", // 20%
    });

    expect(result.adjustment).toBe("20.00");
    expect(result.finalDeliveryFee).toBe("80.00");
  });

  it("calculates fixed delivery fee reduction bounded by base fee", () => {
    const result = resolveDeliveryFeeSubscriptionAdjustment({
      baseDeliveryFee: "50.00",
      benefitType: "DELIVERY_FEE_FIXED_REDUCTION",
      amount: "60.00", // exceeds 50
    });

    // Bounded discount: cannot exceed baseDeliveryFee
    expect(result.adjustment).toBe("50.00");
    expect(result.finalDeliveryFee).toBe("0.00");
  });

  it("applies remaining amount ceiling on period allowance benefit", () => {
    const result = resolveDeliveryFeeSubscriptionAdjustment({
      baseDeliveryFee: "100.00",
      benefitType: "DELIVERY_FEE_PERIOD_ALLOWANCE",
      amount: "50.00",
      remainingAmount: "30.00",
    });

    expect(result.adjustment).toBe("30.00");
    expect(result.finalDeliveryFee).toBe("70.00");
  });

  it("throws on invalid base fee input", () => {
    expect(() =>
      resolveDeliveryFeeSubscriptionAdjustment({
        baseDeliveryFee: "-10.00",
        benefitType: "DELIVERY_FEE_PERCENT_REDUCTION",
        amount: "10",
      })
    ).toThrowError(SubscriptionError);
  });
});
