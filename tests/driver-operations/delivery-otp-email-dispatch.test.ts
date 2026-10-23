import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ intent: vi.fn(), delivery: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  notificationEventIntent: { findUnique: mocks.intent },
  notificationDelivery: { findUnique: mocks.delivery },
} }));
vi.mock("@/lib/notifications/security-email-delivery", () => ({
  deliverSecurityEmail: mocks.send,
}));
import { dispatchIssuedDeliveryOtpEmail } from "@/lib/services/delivery-otp-email-dispatch.service";
beforeEach(() => vi.resetAllMocks());
describe("completion-critical delivery OTP provider acknowledgment", () => {
  it("does not report sent when the email is only queued or retrying", async () => {
    mocks.intent.mockResolvedValueOnce({ id: "intent-1", sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "DELIVERY_OTP" });
    mocks.delivery.mockResolvedValueOnce({ id: "delivery-1" });
    mocks.send.mockResolvedValueOnce({ accepted: false, status: "FAILED_RETRYABLE" });
    expect(await dispatchIssuedDeliveryOtpEmail("operation-1")).toEqual({ accepted: false, status: "FAILED_RETRYABLE" });
    expect(mocks.send).toHaveBeenCalledWith("delivery-1");
  });
  it("only acknowledges provider-accepted delivery", async () => {
    mocks.intent.mockResolvedValueOnce({ id: "intent-1", sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "DELIVERY_OTP" });
    mocks.delivery.mockResolvedValueOnce({ id: "delivery-1" });
    mocks.send.mockResolvedValueOnce({ accepted: true, status: "PROVIDER_ACCEPTED" });
    expect(await dispatchIssuedDeliveryOtpEmail("operation-1")).toEqual({ accepted: true, status: "PROVIDER_ACCEPTED" });
  });
  it("never sends an unrelated or missing intent", async () => {
    mocks.intent.mockResolvedValueOnce({ id: "intent-1", sourceAuthority: "LEGACY_EMAIL_ADAPTER", eventType: "DELIVERY_OTP" });
    expect((await dispatchIssuedDeliveryOtpEmail("operation-1")).accepted).toBe(false);
    mocks.intent.mockResolvedValueOnce(null);
    expect((await dispatchIssuedDeliveryOtpEmail("operation-2")).accepted).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("never acknowledges an absent email delivery record", async () => {
    mocks.intent.mockResolvedValueOnce({ id: "intent-1", sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "DELIVERY_OTP" });
    mocks.delivery.mockResolvedValueOnce(null);
    expect((await dispatchIssuedDeliveryOtpEmail("operation-1")).accepted).toBe(false);
  });
});
