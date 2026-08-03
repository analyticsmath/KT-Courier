import { describe, expect, it } from "vitest";
import { getDriverOperationActions } from "@/lib/driver-operations/operation-policy";
import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
describe("GET /api/driver/workbench contract", () => { it("does not expose actions to a non-current driver", () => { expect(getDriverOperationActions({ assignmentId:"a", assignmentVersion:1, assignmentStatus:OrderAssignmentStatus.ACCEPTED, orderId:"o", orderStatus:OrderStatus.PICKED_UP, currentDriverProfileId:"other", driverProfileId:"driver", driverActive:true, driverUserId:"u" }).canStartTransit).toBe(false); }); });
