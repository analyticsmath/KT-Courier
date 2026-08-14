import { describe, expect, it } from "vitest";
import { assertNotificationContent, deliveryEligible, nextRetryAt, signMarketingUnsubscribe, verifyMarketingUnsubscribe } from "@/lib/notifications/contracts";
import { renderNotificationTemplate, type TemplateVariable } from "@/lib/notifications/template-renderer";
import { NotificationService } from "@/lib/notifications/notification.service";
import { NotificationDeliveryService, NotificationSuppressionService } from "@/lib/notifications/authority";
import { NotConfiguredEmailProvider, NotConfiguredPushProvider, NotConfiguredSmsProvider } from "@/lib/notifications/providers";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

const variables: TemplateVariable[] = [
  { name: "name", type: "TEXT", required: true, maximumLength: 32, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP", "EMAIL", "SMS"] },
  { name: "when", type: "DATE", required: true, maximumLength: 10, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP", "EMAIL"] },
  { name: "amount", type: "CURRENCY", required: false, maximumLength: 20, sensitivity: "FINANCIAL", allowedChannels: ["IN_APP", "EMAIL"] },
  { name: "route", type: "SAFE_INTERNAL_URL", required: false, maximumLength: 128, sensitivity: "ACCOUNT", allowedChannels: ["IN_APP", "EMAIL"] },
];

describe("Phase 27 strict template renderer and content contracts", () => {
  it("renders only declared typed variables and escapes user HTML", () => {
    expect(renderNotificationTemplate({ template: "Hello {{name}} on {{when}}: {{amount}} {{route}}", variables, values: { name: "<b>Ada</b>", when: "2026-07-26", amount: 12.5, route: "/account/orders" }, channel: "EMAIL", sensitivity: "ACCOUNT", html: true })).toBe("Hello &lt;b&gt;Ada&lt;/b&gt; on 2026-07-26: 12.50 /account/orders");
    expect(renderNotificationTemplate({ template: "Hello {{name}}", variables, values: { name: "Ada" }, channel: "SMS", sensitivity: "ACCOUNT" })).toBe("Hello Ada");
  });

  it("rejects missing, unknown, malformed, restricted, script-like, and oversized content", () => {
    const reject = (input: Parameters<typeof renderNotificationTemplate>[0]) => expect(() => renderNotificationTemplate(input)).toThrow("UNSAFE_NOTIFICATION_CONTENT");
    expect(() => renderNotificationTemplate({ template: "{{name}}", variables, values: {}, channel: "EMAIL", sensitivity: "ACCOUNT" })).toThrow("TEMPLATE_REQUIRED_VARIABLE_MISSING");
    reject({ template: "{{name}}", variables, values: { name: "Ada", extra: "nope" }, channel: "EMAIL", sensitivity: "ACCOUNT" });
    reject({ template: "{{when}}", variables, values: { when: "2026-02-31" }, channel: "EMAIL", sensitivity: "ACCOUNT" });
    reject({ template: "{{route}}", variables, values: { route: "https://attacker.test" }, channel: "EMAIL", sensitivity: "ACCOUNT" });
    reject({ template: "{{name}}", variables: [{ ...variables[0], type: "NOT_A_TYPE" as never }], values: { name: "Ada" }, channel: "EMAIL", sensitivity: "ACCOUNT" });
    reject({ template: "{{secret}}", variables: [{ name: "secret", type: "TEXT", required: true, maximumLength: 12, sensitivity: "RESTRICTED", allowedChannels: ["EMAIL"] }], values: { secret: "private" }, channel: "EMAIL", sensitivity: "RESTRICTED" });
    expect(() => assertNotificationContent({ sensitivity: "ACCOUNT", channel: "EMAIL", body: "<script>alert(1)</script>" })).toThrow("UNSAFE_NOTIFICATION_CONTENT");
    expect(() => assertNotificationContent({ sensitivity: "ACCOUNT", channel: "EMAIL", body: "new Function('x')" })).toThrow("UNSAFE_NOTIFICATION_CONTENT");
    expect(() => assertNotificationContent({ sensitivity: "ACCOUNT", channel: "SMS", body: "x".repeat(1_601) })).toThrow("UNSAFE_NOTIFICATION_CONTENT");
  });

  it("enforces retry bounds, expiry, purpose eligibility, and opaque channel-bound unsubscribe tokens", () => {
    expect(nextRetryAt({ failure: "PROVIDER_RATE_LIMIT", attemptNumber: 1, now: new Date("2026-07-26T00:00:00Z"), retryAfterSeconds: 90 })).toEqual(new Date("2026-07-26T00:01:30Z"));
    expect(nextRetryAt({ failure: "PROVIDER_RATE_LIMIT", attemptNumber: 5 })).toBeNull();
    expect(nextRetryAt({ failure: "TRANSIENT_NETWORK", attemptNumber: 1, now: new Date("2026-07-26T00:00:00Z"), expiresAt: new Date("2026-07-26T00:00:20Z") })).toBeNull();
    expect(deliveryEligible({ purpose: "MARKETING", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true })).toEqual({ eligible: false, reason: "USER_OPTED_OUT" });
    expect(deliveryEligible({ purpose: "MARKETING", channel: "EMAIL", consent: "NOT_REQUESTED", verifiedDestination: true })).toEqual({ eligible: false, reason: "CONSENT_REQUIRED" });
    expect(deliveryEligible({ purpose: "SECURITY", channel: "IN_APP" })).toEqual({ eligible: true });
    const token = signMarketingUnsubscribe({ subjectId: "user-private-id", channel: "EMAIL", expiresAt: new Date(Date.now() + 60_000) }, "test-secret");
    expect(token).not.toContain("user-private-id"); expect(verifyMarketingUnsubscribe(token, "test-secret")).toEqual({ subjectId: "user-private-id", channel: "EMAIL" });
    expect(() => verifyMarketingUnsubscribe(`${token}tampered`, "test-secret")).toThrow("INVALID_UNSUBSCRIBE_TOKEN");
    const expired = signMarketingUnsubscribe({ subjectId: "u1", channel: "EMAIL", expiresAt: new Date(Date.now() - 1) }, "test-secret");
    expect(() => verifyMarketingUnsubscribe(expired, "test-secret")).toThrow("INVALID_UNSUBSCRIBE_TOKEN");
  });
});

describe("Phase 27 provider adapters and provider receipts", () => {
  it("fails closed with normalized non-success results when providers are not configured", async () => {
    await expect(new NotConfiguredEmailProvider().send({ destination: "user@example.test", body: "body", idempotencyKey: "id" })).resolves.toEqual(expect.objectContaining({ accepted: false, failureClass: "CONFIGURATION_FAILURE", safeCode: "EMAIL_PROVIDER_NOT_CONFIGURED" }));
    await expect(new NotConfiguredSmsProvider().send({ destination: "+27000000000", body: "body", idempotencyKey: "id" })).resolves.toEqual(expect.objectContaining({ accepted: false, safeCode: "SMS_PROVIDER_NOT_CONFIGURED" }));
    await expect(new NotConfiguredPushProvider("WEB_PUSH").send({ destination: "masked", body: "body", idempotencyKey: "id" })).resolves.toEqual(expect.objectContaining({ accepted: false, safeCode: "PUSH_PROVIDER_NOT_CONFIGURED" }));
  });

  it("enforces one delivery per logical message/channel and only monotonic provider receipt transitions", async () => {
    const db = createNotificationMemoryDb({ notificationDelivery: [{ id: "delivery-1", publicReference: "delivery-one", messageId: "message-1", recipientUserId: "u1", channel: "EMAIL", provider: "EMAIL_PROVIDER_NOT_CONFIGURED", status: "PROVIDER_ACCEPTED", renderedBody: "body", expiresAt: null }] });
    const service = new NotificationService(db);
    const receipts = new NotificationDeliveryService(db, new Map(), new NotificationSuppressionService(db));
    const initial = { messageId: "message-2", recipientUserId: "u1", channel: "IN_APP" as const, purpose: "TRANSACTIONAL" as const, renderedBody: "body" };
    const created = await service.createDelivery(initial); const replay = await service.createDelivery(initial);
    expect(replay.id).toBe(created.id); expect(created.status).toBe("DELIVERED");
    await receipts.ingestProviderReceipt({ provider: "EMAIL_PROVIDER_NOT_CONFIGURED", providerReceiptId: "provider-1", deliveryId: "delivery-1", type: "DELIVERED" });
    await receipts.ingestProviderReceipt({ provider: "EMAIL_PROVIDER_NOT_CONFIGURED", providerReceiptId: "provider-2", deliveryId: "delivery-1", type: "ACCEPTED" });
    expect(db.__state.notificationDelivery.find((delivery: { id: string }) => delivery.id === "delivery-1")).toMatchObject({ status: "DELIVERED" });
    await expect(receipts.ingestProviderReceipt({ provider: "EMAIL_PROVIDER_NOT_CONFIGURED", providerReceiptId: "provider-1", deliveryId: "delivery-1", type: "BOUNCED" })).rejects.toMatchObject({ code: "NOTIFICATION_PROVIDER_RECEIPT_CONFLICT" });
    await expect(receipts.ingestProviderReceipt({ provider: "OTHER", providerReceiptId: "provider-3", deliveryId: "delivery-1", type: "DELIVERED" })).rejects.toMatchObject({ code: "NOTIFICATION_PROVIDER_RECEIPT_MISMATCH" });
  });
});
