import { describe, expect, it, vi } from "vitest";
import { applySubscriptionEntitlementRefundAdjustment } from "@/lib/subscriptions/subscription-entitlement-refund.service";

describe("subscription entitlement refund adjustment", () => {
  it("returns canonical unused-revocation evidence without editing usage", async () => {
    const repository = { adjustRefundedCycle: vi.fn().mockResolvedValue({ outcome: "ADJUSTED", revokedGrantCount: 1, releasedReservationCount: 1, consumedGrantCount: 0 }) };
    await expect(applySubscriptionEntitlementRefundAdjustment(repository, { invoiceId: "inv_1", refundReference: "RF_1", operationId: "refund-entitlement_1" })).resolves.toMatchObject({ outcome: "ADJUSTED", revokedGrantCount: 1 });
  });

  it("preserves consumed use by requiring reconciliation", async () => {
    const repository = { adjustRefundedCycle: vi.fn().mockResolvedValue({ outcome: "RECONCILIATION_REQUIRED", revokedGrantCount: 0, releasedReservationCount: 0, consumedGrantCount: 1 }) };
    await expect(applySubscriptionEntitlementRefundAdjustment(repository, { invoiceId: "inv_1", refundReference: "RF_1", operationId: "refund-entitlement_2" })).resolves.toMatchObject({ outcome: "RECONCILIATION_REQUIRED", consumedGrantCount: 1 });
  });
});
