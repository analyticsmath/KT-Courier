import { describe, expect, it } from "vitest";
import {
  applySubscriptionEntitlementRefundAdjustment,
  type SubscriptionEntitlementRefundRepository,
} from "@/lib/subscriptions/subscription-entitlement-refund.service";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Entitlement Refund Adjustment Integration Tests", () => {
  it("requires non-empty operationId when adjusting refunded cycle", async () => {
    const fakeRepo: SubscriptionEntitlementRefundRepository = {
      adjustRefundedCycle: async () => ({
        outcome: "ADJUSTED",
        revokedGrantCount: 1,
        releasedReservationCount: 0,
        consumedGrantCount: 0,
      }),
    };

    await expect(
      applySubscriptionEntitlementRefundAdjustment(fakeRepo, {
        invoiceId: "inv-1",
        refundReference: "REF-100",
        operationId: "   ",
      })
    ).rejects.toThrowError(SubscriptionError);
  });

  it("applies adjustment cleanly and returns revoked/released grant counts", async () => {
    const fakeRepo: SubscriptionEntitlementRefundRepository = {
      adjustRefundedCycle: async () => ({
        outcome: "ADJUSTED",
        revokedGrantCount: 2,
        releasedReservationCount: 1,
        consumedGrantCount: 0,
      }),
    };

    const result = await applySubscriptionEntitlementRefundAdjustment(fakeRepo, {
      invoiceId: "inv-1",
      refundReference: "REF-100",
      operationId: "op-ref-adj-1",
    });

    expect(result.outcome).toBe("ADJUSTED");
    expect(result.revokedGrantCount).toBe(2);
    expect(result.releasedReservationCount).toBe(1);
  });
});
