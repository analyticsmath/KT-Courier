import { describe, expect, it } from "vitest";
import { applyMarketplaceStoreOrderAdjustment, beginStoreOrderReview, acceptMarketplaceStoreOrder, createMarketplaceDeliveryBridge, proposeStoreOrderSubstitution, verifyStoreOrderPickupHandoff } from "@/lib/store-orders/store-order.service";
describe("store-order service source lock", () => {
  const hash = "a".repeat(64); const operationId = "operation-source-lock-0001";
  it("does not access persistence before the review source lock", async () => await expect(beginStoreOrderReview({ storeOrderReference: "so_x", actorUserId: "user_x", operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" }));
  it("locks acceptance, substitution, and handoff", async () => {
    await expect(acceptMarketplaceStoreOrder({ storeOrderReference: "so_x", actorUserId: "user_x", preparationMinutes: 20, pickupInstructions: "Pickup", operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    await expect(proposeStoreOrderSubstitution({ storeOrderReference: "so_x", issueReference: "issue_x", actorUserId: "user_x", substituteOfferReference: "offer_x", substituteVariantReference: "variant_x", quantity: 1, operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    await expect(verifyStoreOrderPickupHandoff({ storeOrderReference: "so_x", driverUserId: "driver_x", driverProfileId: "profile_x", pickupCode: "123456", operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  });
  it("locks financial and courier composition before persistence", async () => {
    await expect(applyMarketplaceStoreOrderAdjustment({ storeOrderReference: "so_x", adjustmentReference: "soadj_x", actorUserId: "admin_x", operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    await expect(createMarketplaceDeliveryBridge({ storeOrderReference: "so_x", actorUserId: "admin_x", operationId, requestHash: hash })).rejects.toMatchObject({ code: "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  });
});
