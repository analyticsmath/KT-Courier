import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import { getDriverOperationActions } from "@/lib/driver-operations/operation-policy";

describe("driver workbench contract", () => {
  it("returns server-derived actions for the current accepted driver only", () => {
    const actions = getDriverOperationActions({ assignmentId: "a", assignmentVersion: 2, assignmentStatus: OrderAssignmentStatus.ACCEPTED, orderId: "o", orderStatus: OrderStatus.IN_TRANSIT, currentDriverProfileId: "d", driverProfileId: "d", driverActive: true, driverUserId: "u" });
    expect(actions.canRequestDeliveryOtp).toBe(true);
    expect(actions.canCompleteDelivery).toBe(true);
  });
});
