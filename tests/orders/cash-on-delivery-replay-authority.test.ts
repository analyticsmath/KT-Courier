import { describe, expect, it, vi } from "vitest";
import { assertCashCollectionReplayAuthority } from "@/lib/services/cash-on-delivery.service";

const receipt = { id: "cod-1", collectorDriverId: "driver-1" };
const request = { collectorDriverId: "driver-1", actorUserId: "driver-account-1", operationId: "collection-operation-1" };
const digest = "immutable-request-hash";

function database(overrides: Record<string, unknown> | null = {}) {
  const evidence = overrides === null ? null : {
    cashOnDeliveryId: receipt.id,
    eventType: "COLLECTED",
    actorUserId: request.actorUserId,
    requestHash: digest,
    ...overrides,
  };
  const findUnique = vi.fn().mockResolvedValue(evidence);
  return { cashOnDeliveryEvent: { findUnique } };
}

describe("cash-on-delivery collection receipt replay authorization", () => {
  it("permits only the original collector and actor with matching immutable collection evidence", async () => {
    const db = database();
    await expect(assertCashCollectionReplayAuthority(db as never, receipt, request, digest)).resolves.toBeUndefined();
    expect(db.cashOnDeliveryEvent.findUnique).toHaveBeenCalledWith({
      where: { operationId: "collection:collection-operation-1" },
      select: {
        cashOnDeliveryId: true, eventType: true, actorUserId: true,
        requestHash: true,
      },
    });
  });

  it("rejects a foreign driver before looking up receipt metadata", async () => {
    const db = database();
    await expect(assertCashCollectionReplayAuthority(db as never, receipt,
      { ...request, collectorDriverId: "driver-2" }, digest))
      .rejects.toMatchObject({ code: "COD_COLLECTOR_NOT_AUTHORIZED" });
    expect(db.cashOnDeliveryEvent.findUnique).not.toHaveBeenCalled();
  });

  for (const [reason, overrides] of [
    ["missing", null],
    ["other collection", { cashOnDeliveryId: "cod-2" }],
    ["other actor", { actorUserId: "driver-account-2" }],
    ["other event", { eventType: "COMMITTED" }],
    ["different request", { requestHash: "tampered-hash" }],
  ] as const) {
    it("rejects " + reason + " receipt evidence", async () => {
      const db = database(overrides);
      await expect(assertCashCollectionReplayAuthority(db as never, receipt, request, digest))
        .rejects.toMatchObject({ code: "COD_COLLECTOR_NOT_AUTHORIZED" });
    });
  }
});
