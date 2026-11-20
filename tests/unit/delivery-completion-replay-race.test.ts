import { beforeEach, describe, expect, it, vi } from "vitest";
import { driverOperationRequestHash } from "@/lib/driver-operations/idempotency";

const mocks = vi.hoisted(() => ({ findCommand: vi.fn(), findAssignment: vi.fn(), currentDriver: vi.fn(), replayAuthority: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { driverOperationCommand: { findUnique: mocks.findCommand }, orderAssignment: { findFirst: mocks.findAssignment } } }));
vi.mock("@/lib/driver-operations/authority", () => ({ assertAcceptedCurrentDriver: mocks.currentDriver }));
vi.mock("@/lib/driver-operations/replay-authority", () => ({ assertDriverReplayAuthority: mocks.replayAuthority }));
vi.mock("@/lib/dto/delivery.dto", () => ({ toDeliveryAssignmentDto: (assignment: unknown) => assignment }));
import { completeDelivery } from "@/lib/services/delivery-execution.service";

const input = { operationId: "complete-operation-123", assignmentVersion: 1, otpCode: "123456", recipientName: "Recipient", driverNote: "Delivered", confirmDelivery: true as const };
const receipt = { type: "DELIVERY_COMPLETE", orderId: "order-1", assignmentId: "assignment-1", driverProfileId: "driver-1", orderStatus: "DELIVERED", assignmentStatus: "COMPLETED", completedAt: new Date().toISOString() };
const assignment = { id: "assignment-1", status: "COMPLETED", driverProfile: { status: "ACTIVE" }, order: { status: "DELIVERED" } };

beforeEach(() => { vi.clearAllMocks(); });

describe("delivery completion replay race", () => {
  it("returns the authorized exact receipt when another request completes before eligibility is read", async () => {
    mocks.findCommand.mockResolvedValueOnce(null).mockResolvedValueOnce({ requestHash: driverOperationRequestHash(input), resultSnapshot: receipt, completedAt: new Date() });
    mocks.findAssignment.mockResolvedValue(assignment);
    mocks.currentDriver.mockResolvedValue(undefined);
    mocks.replayAuthority.mockResolvedValue(undefined);
    const result = await completeDelivery("assignment-1", "driver-1", "user-1", input);
    expect(result).toMatchObject({ ok: true, operationResult: receipt });
    expect(mocks.replayAuthority).toHaveBeenCalledWith("assignment-1", "driver-1", "user-1", receipt);
  });

  it("does not expose a receipt to a driver who fails replay authorization", async () => {
    mocks.findCommand.mockResolvedValueOnce(null).mockResolvedValueOnce({ requestHash: driverOperationRequestHash(input), resultSnapshot: receipt, completedAt: new Date() });
    mocks.findAssignment.mockResolvedValue(assignment);
    mocks.currentDriver.mockResolvedValue(undefined);
    mocks.replayAuthority.mockRejectedValue(new Error("Replay forbidden"));
    await expect(completeDelivery("assignment-1", "driver-1", "user-1", input)).resolves.toEqual({ ok: false, error: "Replay forbidden" });
  });

  it("rejects a conflicting payload even if the assignment has completed", async () => {
    mocks.findCommand.mockResolvedValueOnce(null).mockResolvedValueOnce({ requestHash: "different", resultSnapshot: receipt, completedAt: new Date() });
    mocks.findAssignment.mockResolvedValue(assignment);
    mocks.currentDriver.mockResolvedValue(undefined);
    const result = await completeDelivery("assignment-1", "driver-1", "user-1", input);
    expect(result).toMatchObject({ ok: false, error: "This operation ID was already used with different request data." });
    expect(mocks.replayAuthority).not.toHaveBeenCalled();
  });

  it("rechecks the receipt if the initial driver check races with completion", async () => {
    mocks.findCommand.mockResolvedValueOnce(null).mockResolvedValueOnce({ requestHash: driverOperationRequestHash(input), resultSnapshot: receipt, completedAt: new Date() });
    mocks.findAssignment.mockResolvedValue(assignment);
    mocks.currentDriver.mockRejectedValue(new Error("Assignment completed"));
    mocks.replayAuthority.mockResolvedValue(undefined);
    await expect(completeDelivery("assignment-1", "driver-1", "user-1", input)).resolves.toMatchObject({ ok: true, operationResult: receipt });
  });
});
