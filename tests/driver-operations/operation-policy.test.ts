import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import { getDriverOperationActions } from "@/lib/driver-operations/operation-policy";

const state = (orderStatus: OrderStatus, assignmentStatus: OrderAssignmentStatus = OrderAssignmentStatus.ACCEPTED) => getDriverOperationActions({
  assignmentId: "a", assignmentVersion: 1, assignmentStatus, orderId: "o", orderStatus,
  currentDriverProfileId: "d", driverProfileId: "d", driverActive: true, driverUserId: "u",
});
describe("driver operation policy", () => {
  it("blocks offers from pickup and permits accepted pickup", () => {
    expect(state(OrderStatus.CONFIRMED, OrderAssignmentStatus.ASSIGNED).canConfirmPickup).toBe(false);
    expect(state(OrderStatus.CONFIRMED).canConfirmPickup).toBe(true);
  });
  it("models transit, retry, completion and terminal states", () => {
    expect(state(OrderStatus.PICKED_UP).canStartTransit).toBe(true);
    expect(state(OrderStatus.IN_TRANSIT).canCompleteDelivery).toBe(true);
    expect(state(OrderStatus.DELIVERY_ATTEMPTED).canRetryDelivery).toBe(true);
    expect(state(OrderStatus.DELIVERED).blockedReasons).toContain("ORDER_TERMINAL");
  });
});
