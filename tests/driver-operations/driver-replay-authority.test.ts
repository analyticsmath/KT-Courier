import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DriverOperationSnapshot } from "@/lib/driver-operations/idempotency";
const find = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { orderAssignment: { findFirst: find } } }));
import { assertDriverReplayAuthority } from "@/lib/driver-operations/replay-authority";
describe("actor-scoped driver receipt replay (mock database unit)", () => {
  const receipt: DriverOperationSnapshot = { type: "DELIVERY_OTP_REQUEST", orderId: "owned-order", assignmentId: "owned-assignment", driverProfileId: "owned-driver", orderStatus: "IN_TRANSIT", assignmentStatus: "ACCEPTED", completedAt: "2026-10-08T00:00:00Z" };
  beforeEach(() => find.mockReset());
  it("rejects foreign profile before looking up an assignment", async () => {
    await expect(assertDriverReplayAuthority("owned-assignment", "foreign-driver", "foreign-user", receipt)).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" }); expect(find).not.toHaveBeenCalled();
  });
  it("rejects reuse on another assignment even for the same driver", async () => {
    await expect(assertDriverReplayAuthority("other-assignment", "owned-driver", "owned-user", receipt)).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" }); expect(find).not.toHaveBeenCalled();
  });
  it("rejects inactive or unowned assignment instead of returning receipt evidence", async () => {
    find.mockResolvedValue(null); await expect(assertDriverReplayAuthority("owned-assignment", "owned-driver", "inactive-user", receipt)).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
    expect(find.mock.calls[0][0].where.driverProfile).toEqual({ userId: "inactive-user", status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } });
  });
  it("allows the actor-owned receipt after completion without trusting a stale command version", async () => {
    find.mockResolvedValue({ id: "owned-assignment" }); await expect(assertDriverReplayAuthority("owned-assignment", "owned-driver", "owned-user", { ...receipt, orderStatus: "DELIVERED", assignmentStatus: "COMPLETED" })).resolves.toBeUndefined();
    expect(find.mock.calls[0][0].where).toMatchObject({ id: "owned-assignment", orderId: "owned-order", driverProfileId: "owned-driver" }); expect(find.mock.calls[0][0].where).not.toHaveProperty("version");
  });
});
