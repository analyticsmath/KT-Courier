import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DriverOperationSnapshot } from "@/lib/driver-operations/idempotency";
import { DriverOperationError } from "@/lib/driver-operations/errors";

const lookup = vi.hoisted(() => vi.fn());
const replay = vi.hoisted(() => vi.fn());
const authority = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: { orderAssignment: { findFirst: lookup } },
}));
vi.mock("@/lib/driver-operations/idempotency", () => ({
  findOperationReplay: replay,
  createOperationReceiptInTx: vi.fn(),
  completeOperationReceiptInTx: vi.fn(),
  getCompletedOperationResult: vi.fn(),
  isOperationReceiptConflict: vi.fn(),
}));
vi.mock("@/lib/driver-operations/replay-authority", () => ({
  assertDriverReplayAuthority: authority,
}));
vi.mock("@/lib/dto/pickup.dto", () => ({
  toWorkbenchAssignmentDto: (row: { id: string }) => ({ id: row.id }),
}));

import { completePickup, startPickup } from "@/lib/services/pickup-custody.service";

const receipt: DriverOperationSnapshot = {
  type: "PICKUP_CONFIRM",
  orderId: "order-1",
  assignmentId: "assignment-1",
  driverProfileId: "profile-1",
  orderStatus: "PICKED_UP",
  assignmentStatus: "ACCEPTED",
  completedAt: "2026-11-12T08:00:00Z",
};

const args = [
  "assignment-1",
  "profile-1",
  "user-1",
] as const;

describe("parcel driver pickup receipt replay authorization", () => {
  beforeEach(() => {
    lookup.mockReset();
    replay.mockReset();
    authority.mockReset();
    lookup.mockResolvedValue({ id: "assignment-1" });
    replay.mockResolvedValue(receipt);
    authority.mockResolvedValue(undefined);
  });

  for (const [name, call] of [
    ["pickup start", () => startPickup(...args, { operationId: "op-1", assignmentVersion: 1 })],
    ["pickup completion", () => completePickup(...args, {
      operationId: "op-2",
      assignmentVersion: 1,
      parcelCount: 1,
      parcelCondition: "GOOD",
      confirmPickup: true,
    })],
  ] as const) {
    it("enforces the actor and aggregate before disclosing a " + name + " receipt", async () => {
      const result = await call();
      expect(result.ok).toBe(true);
      expect(authority).toHaveBeenCalledWith(...args, receipt);
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it("denies " + name + " replay before any assignment details are fetched", async () => {
      authority.mockRejectedValue(new DriverOperationError(
        "Assignment replay is unavailable for this driver.",
        "DRIVER_OPERATION_FORBIDDEN",
      ));
      const result = await call();
      expect(result).toMatchObject({ ok: false, error: "Assignment replay is unavailable for this driver." });
      expect(lookup).not.toHaveBeenCalled();
    });
  }
});
