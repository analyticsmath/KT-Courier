import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import { getDriverOperationActions } from "@/lib/driver-operations/operation-policy";

describe("driver workbench presentation state", () => {
  it("renders only server-permitted actions and models OTP restrictions", () => {
    const actions = getDriverOperationActions({ assignmentId: "a", assignmentVersion: 1, assignmentStatus: OrderAssignmentStatus.ACCEPTED, orderId: "o", orderStatus: OrderStatus.DELIVERY_ATTEMPTED, currentDriverProfileId: "d", driverProfileId: "d", driverActive: true, driverUserId: "u" });
    expect(actions.canRetryDelivery).toBe(true);
    expect(actions.canConfirmPickup).toBe(false);
  });
  it("identifies terminal states for a non-interactive final step", () => {
    const actions = getDriverOperationActions({ assignmentId: "a", assignmentVersion: 1, assignmentStatus: OrderAssignmentStatus.COMPLETED, orderId: "o", orderStatus: OrderStatus.DELIVERED, currentDriverProfileId: null, driverProfileId: "d", driverActive: true, driverUserId: "u" });
    expect(actions.blockedReasons).toContain("ORDER_TERMINAL");
  });
});
