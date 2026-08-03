import { describe, expect, it } from "vitest";
import { NotificationProcessorService } from "@/lib/notifications/processor.service";
import { RECONCILIATION_ACTIONS } from "@/lib/notifications/authority";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

describe("Phase 27 bounded processors", () => {
  it("uses real candidates with deterministic operation IDs in dry-run mode and rejects invalid limits", async () => {
    const db = createNotificationMemoryDb({ notificationCategory: [{ id: "category-1", publicReference: "category-one", key: "ORDER_STATUS", status: "ACTIVE" }] });
    const service = new NotificationProcessorService(db, {});
    const first = await service.run({ operation: "preflight", apply: false, limit: 10 });
    const second = await service.run({ operation: "preflight", apply: false, limit: 10 });
    expect(first).toEqual(second); expect(first).toMatchObject({ operation: "preflight", apply: false, candidates: [{ reference: "category-one", operationId: expect.stringMatching(/^phase27:preflight:[a-f0-9]{24}$/) }] });
    for (const limit of [0, -1, 1.5, 1_001]) await expect(service.run({ operation: "preflight", apply: false, limit })).rejects.toThrow("Invalid notification processor request.");
  });

  it("keeps apply locked before lifecycle mutation and exposes no generic reconciliation resolve action", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ id: "delivery-1", publicReference: "delivery-one", status: "QUEUED", createdAt: new Date() }] });
    const service = new NotificationProcessorService(db, { delivery: { expire: async () => { throw new Error("must remain locked"); } }, endpoints: { markStale: async () => { throw new Error("must remain locked"); } }, reconciliation: { act: async () => { throw new Error("must remain locked"); } } });
    await expect(service.run({ operation: "deliver", apply: true, limit: 1 })).rejects.toMatchObject({ code: "NOTIFICATION_CONSOLIDATED_VALIDATION_NOT_APPROVED" });
    expect(RECONCILIATION_ACTIONS).toEqual(["rescan", "retry-source-intake", "retry-fan-out", "retry-delivery", "refresh-provider-receipt", "deactivate-invalid-endpoint", "rebuild-digest"]);
  });
});
