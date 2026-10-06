import { describe, expect, it, vi } from "vitest";
import { NotificationDeliveryService, NotificationSuppressionService } from "@/lib/notifications/authority";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

// Isolate the delivery contract; the separate production-lock suite still requires a closed runtime.
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: vi.fn() }));

const delivery = { id: "delivery-1", publicReference: "delivery-one", messageId: "message-1", recipientUserId: "u1", channel: "EMAIL", status: "QUEUED", renderedBody: "body", expiresAt: null };

describe("notification retry and suppression boundaries", () => {
  it("persists a retryable result when the provider throws instead of stranding a sending delivery", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [delivery] });
    const send = vi.fn().mockRejectedValue(new Error("Transport interrupted"));
    const service = new NotificationDeliveryService(db, new Map([["EMAIL", { name: "RESEND_EMAIL", send }]]), new NotificationSuppressionService(db));
    const result = await service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "worker:delivery-one" });
    expect(result.status).toBe("FAILED_RETRYABLE");
    expect(db.__state.notificationDeliveryAttempt[0]).toMatchObject({ status: "FAILED", failureClass: "TRANSIENT_NETWORK" });
    expect(JSON.stringify(db.__state)).not.toContain("Transport interrupted");
  });
  it("reuses one provider key across distinct durable attempts", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [delivery] });
    const send = vi.fn().mockResolvedValueOnce({ accepted: false, failureClass: "TRANSIENT_NETWORK", retryAfterSeconds: 1 }).mockResolvedValueOnce({ accepted: true, providerMessageReference: "provider-1" });
    const service = new NotificationDeliveryService(db, new Map([["EMAIL", { name: "TEST_PROVIDER", send }]]), new NotificationSuppressionService(db));
    await service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "worker:delivery-one" });
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { nextAttemptAt: new Date(Date.now() - 1) } });
    const completed = await service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "worker:delivery-one" });
    expect(completed.status).toBe("PROVIDER_ACCEPTED");
    expect(send.mock.calls.map(([input]) => input.idempotencyKey)).toEqual(["delivery-one", "delivery-one"]);
    expect(db.__state.notificationDeliveryAttempt).toHaveLength(2);
  });
  it("does not claim a delivery with no configured channel provider", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [delivery] });
    const service = new NotificationDeliveryService(db, new Map(), new NotificationSuppressionService(db));
    await expect(service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "one" })).rejects.toMatchObject({ code: "NOTIFICATION_PROVIDER_NOT_CONFIGURED" });
    expect(db.__state.notificationDelivery[0].status).toBe("QUEUED");
    expect(db.__state.notificationDeliveryAttempt).toHaveLength(0);
  });
  it("does not send a retry before its due time", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ ...delivery, status: "FAILED_RETRYABLE", nextAttemptAt: new Date(Date.now() + 60_000) }] });
    const send = vi.fn();
    const service = new NotificationDeliveryService(db, new Map([["EMAIL", { name: "TEST_PROVIDER", send }]]), new NotificationSuppressionService(db));
    await service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "one" });
    expect(send).not.toHaveBeenCalled();
    expect(db.__state.notificationDelivery[0].status).toBe("FAILED_RETRYABLE");
  });
  it("scopes permanent destination failure to the actual recipient", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [delivery] });
    const send = vi.fn().mockResolvedValue({ accepted: false, failureClass: "INVALID_DESTINATION" });
    const service = new NotificationDeliveryService(db, new Map([["EMAIL", { name: "TEST_PROVIDER", send }]]), new NotificationSuppressionService(db));
    await service.deliver({ deliveryId: delivery.id, destination: "user@example.test", operationId: "one" });
    expect(db.__state.notificationSuppression).toHaveLength(1);
    expect(db.__state.notificationSuppression[0].userId).toBe("u1");
  });
  it("cannot create an unscoped suppression", async () => {
    const service = new NotificationSuppressionService(createNotificationMemoryDb());
    await expect(service.suppress({ channel: "EMAIL", reason: "USER_REVOCATION" })).rejects.toMatchObject({ code: "NOTIFICATION_SUPPRESSION_SUBJECT_REQUIRED" });
  });
});
