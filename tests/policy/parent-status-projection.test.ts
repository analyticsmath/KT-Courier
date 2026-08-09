import { describe, expect, it } from "vitest";
import { projectMarketplaceParentStatus } from "@/lib/store-orders/store-order.service";
describe("parent-status-projection", () => {
  it("keeps sibling store outcomes independent", () => {
    const result = projectMarketplaceParentStatus([{ acceptanceStatus: "ACCEPTED", preparationStatus: "HANDED_OFF", resolutionStatus: "CLEAR", deliveryBridgeStatus: "HANDED_OFF" }, { acceptanceStatus: "REJECTED", preparationStatus: "ABORTED", resolutionStatus: "RESOLVED", deliveryBridgeStatus: "NOT_REQUESTED" }]);
    expect(result).toMatchObject({ status: "IN_PROGRESS", handedOff: 1, rejectedOrCancelled: 1 });
  });
  it("requires every required store delivery before projecting complete", () => {
    const result = projectMarketplaceParentStatus([{ acceptanceStatus: "ACCEPTED", preparationStatus: "HANDED_OFF", resolutionStatus: "CLEAR", deliveryBridgeStatus: "DELIVERED" }, { acceptanceStatus: "ACCEPTED", preparationStatus: "HANDED_OFF", resolutionStatus: "CLEAR", deliveryBridgeStatus: "DELIVERED" }]);
    expect(result).toMatchObject({ status: "ALL_STORES_DELIVERED", delivered: 2 });
  });
});
