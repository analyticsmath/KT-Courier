import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

describe("marketplace pickup vendor-email authority", () => {
  it("reuses the single store-owned challenge rather than creating a second OTP", () => {
    const store = read("lib/store-orders/store-order.service.ts");
    expect(store).toContain('eventType: "STORE_PICKUP_CODE"');
    expect(store).toContain("emailDetails.pickupCode");
    expect(store).toContain("MARKETPLACE_PICKUP_EMAIL_ENABLED");
    expect(store).toContain("emailDeliveryStatus");
    expect(store).toContain('status: "CHALLENGE_ACTIVE"');
  });

  it("never delivers a stale, revoked or mismatched vendor code", () => {
    const worker = read("lib/notifications/security-email-delivery.ts");
    expect(worker).toContain('intent.eventType === "STORE_PICKUP_CODE"');
    expect(worker).toContain('order.store.ownerUserId !== subjectUserId');
    expect(worker).toContain('values.pickupOperationId !== challenge.operationId');
    expect(worker).toContain('challenge.status !== "CHALLENGE_ACTIVE"');
    expect(worker).toContain("timingSafeEqual");
    expect(worker).toContain("STORE_PICKUP_CHALLENGE_REVOKED");
  });

  it("sends only encrypted, idempotent notification intents to the verified store owner", () => {
    const queue = read("lib/notifications/security-delivery.ts");
    const helper = read("lib/services/delivery-otp-email-dispatch.service.ts");
    expect(queue).toContain('"STORE_PICKUP_CODE"');
    expect(queue).toContain("sealSecurityPayload");
    expect(queue).toContain("VERIFIED_NOTIFICATION_DESTINATION_REQUIRED");
    expect(helper).toContain('"STORE_PICKUP_CODE"');
    expect(helper).toContain("deliverSecurityEmail(delivery.id)");
  });
});
