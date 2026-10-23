import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ bridge: vi.fn(), intents: vi.fn(), deliveries: vi.fn(), attempts: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  marketplaceStoreOrderDeliveryBridge: { findUnique: mocks.bridge },
  notificationEventIntent: { findMany: mocks.intents },
  notificationDelivery: { findMany: mocks.deliveries },
  notificationDeliveryAttempt: { findMany: mocks.attempts },
}}));
import { listAdminHandoverEmailEvidence } from "@/lib/services/admin-handover-email-evidence.service";
import { readFileSync } from "node:fs";

describe("order-scoped administrative OTP email audit", () => {
  beforeEach(() => vi.resetAllMocks());
  it("reads only canonical sender/recipient intents for the selected order", async () => {
    mocks.intents.mockResolvedValueOnce([
      { id: "intent1", eventType: "PICKUP_OTP", createdAt: new Date() },
      { id: "intent2", eventType: "DELIVERY_OTP", createdAt: new Date() },
    ]);
    mocks.deliveries.mockResolvedValueOnce([
      { id: "del1", messageId: "intent1", status: "PROVIDER_ACCEPTED", provider: "RESEND_EMAIL", eligibilityReason: null },
      { id: "del2", messageId: "intent2", status: "FAILED_RETRYABLE", provider: null, eligibilityReason: null },
    ]);
    mocks.attempts.mockResolvedValueOnce([
      { deliveryId: "del1", status: "SUCCEEDED", failureClass: null, safeProviderCode: null },
      { deliveryId: "del2", status: "FAILED", failureClass: "TRANSIENT", safeProviderCode: "PROVIDER_UNAVAILABLE" },
    ]);
    const result = await listAdminHandoverEmailEvidence("one-order");
    expect(mocks.intents.mock.calls[0][0].where).toEqual({
      aggregateReference: "one-order", sourceAuthority: "AUTHENTICATION_SECURITY",
      eventType: { in: ["PICKUP_OTP", "DELIVERY_OTP"] },
    });
    expect(result).toMatchObject([
      { stage: "PICKUP", deliveryStatus: "PROVIDER_ACCEPTED" },
      { stage: "DELIVERY", deliveryStatus: "FAILED_RETRYABLE", safeProviderCode: "PROVIDER_UNAVAILABLE" },
    ]);
    expect(JSON.stringify(result)).not.toContain("otp");
    expect(JSON.stringify(result)).not.toContain("recipient@example");
  });
  it("returns empty evidence without any private payload fetch", async () => {
    mocks.intents.mockResolvedValueOnce([]);
    expect(await listAdminHandoverEmailEvidence("no-notifications")).toEqual([]);
    expect(mocks.deliveries).not.toHaveBeenCalled();
  });
  it("includes only the vendor email linked to this courier order's verified marketplace bridge", async () => {
    mocks.bridge.mockResolvedValueOnce({ storeOrder: { publicReference: "mso-for-this-courier" } });
    mocks.intents.mockResolvedValueOnce([
      { id: "vendor-intent", eventType: "STORE_PICKUP_CODE", createdAt: new Date("2026-10-23T18:30:00Z") },
      { id: "delivery-intent", eventType: "DELIVERY_OTP", createdAt: new Date("2026-10-23T18:31:00Z") },
    ]);
    mocks.deliveries.mockResolvedValueOnce([
      { id: "vendor-del", messageId: "vendor-intent", status: "PROVIDER_ACCEPTED", provider: "RESEND_EMAIL", eligibilityReason: null },
    ]);
    mocks.attempts.mockResolvedValueOnce([]);
    const result = await listAdminHandoverEmailEvidence("courier-one");
    expect(mocks.bridge).toHaveBeenCalledWith({
      where: { courierOrderId: "courier-one" },
      select: { storeOrder: { select: { publicReference: true } } },
    });
    const where = mocks.intents.mock.calls[0][0].where;
    expect(where.sourceAuthority).toBe("AUTHENTICATION_SECURITY");
    expect(where.OR).toEqual([
      { aggregateReference: "courier-one", eventType: { in: ["PICKUP_OTP", "DELIVERY_OTP"] } },
      { aggregateReference: "mso-for-this-courier", eventType: "STORE_PICKUP_CODE" },
    ]);
    expect(result).toMatchObject([
      { stage: "STORE_PICKUP", deliveryStatus: "PROVIDER_ACCEPTED" },
      { stage: "DELIVERY", deliveryStatus: "NOT_QUEUED" },
    ]);
    expect(JSON.stringify(result)).not.toContain("sender@example");
    expect(JSON.stringify(result)).not.toContain("123456");
  });
  it("does not inspect vendor notifications for courier orders without a linked store order", async () => {
    mocks.bridge.mockResolvedValueOnce(null);
    mocks.intents.mockResolvedValueOnce([]);
    expect(await listAdminHandoverEmailEvidence("ordinary-parcel")).toEqual([]);
    expect(mocks.intents.mock.calls[0][0].where).toEqual({
      aggregateReference: "ordinary-parcel", sourceAuthority: "AUTHENTICATION_SECURITY",
      eventType: { in: ["PICKUP_OTP", "DELIVERY_OTP"] },
    });
  });
  it("renders an administrator diagnostic without plaintext codes", () => {
    const page=readFileSync(new URL("../../app/(admin)/admin/orders/[id]/page.tsx",import.meta.url),"utf8");
    expect(page).toContain('title="Pickup and delivery email status"');
    expect(page).toContain("listAdminHandoverEmailEvidence(id)");
    expect(page).toContain("Provider acceptance confirms submission");
    expect(page).toContain('item.stage === "STORE_PICKUP"');
  });
});
