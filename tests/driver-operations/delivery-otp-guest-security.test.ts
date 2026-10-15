import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationPolicyError } from "@/lib/notifications/contracts";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { hashOtp } from "@/lib/auth/otp";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), user: vi.fn(), send: vi.fn(), claim: vi.fn(), finish: vi.fn(), update: vi.fn(), intent: null as Record<string, unknown> | null, secure: null as Record<string, unknown> | null, delivery: null as Record<string, unknown> | null, otp: null as Record<string, unknown> | null, command: null as Record<string, unknown> | null }));
vi.mock("@/lib/services/delivery-recipient.service", () => ({ resolveDeliveryOtpRecipient: mocks.resolve }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => undefined }));
vi.mock("@/lib/notifications/providers", () => ({ ResendEmailProvider: class { send = mocks.send; } }));
vi.mock("@/lib/email/email-templates", () => ({ renderTemplate: (_type: string, values: Record<string, unknown>) => ({ subject: "Delivery code", text: `Code: ${values.otp}` }) }));
vi.mock("@/lib/notifications/email-delivery-recovery", () => ({ claimEmailAttempt: mocks.claim, finishEmailAttempt: mocks.finish }));
vi.mock("@/lib/db/prisma", () => {
  const db = {
    $queryRaw: vi.fn(),
    user: { findUnique: mocks.user },
    driverOperationCommand: { findUnique: async () => mocks.command },
    deliveryOtp: { findFirst: async ({ where }: { where: { id: string } }) => mocks.otp?.id === where.id && !mocks.otp.consumedAt && !mocks.otp.invalidatedAt && !mocks.otp.lockedAt ? mocks.otp : null },
    notificationEventIntent: { findUnique: async () => mocks.intent, create: async ({ data }: { data: Record<string, unknown> }) => (mocks.intent = { id: "intent", ...data }) },
    notificationSecurePayload: { findUnique: async () => mocks.secure, create: async ({ data }: { data: Record<string, unknown> }) => (mocks.secure = data) },
    notificationDelivery: { findUnique: async () => mocks.delivery, updateMany: mocks.update, upsert: async ({ create }: { create: Record<string, unknown> }) => (mocks.delivery ??= { id: "delivery", ...create }) },
  };
  return { prisma: { ...db, $transaction: async (work: (tx: unknown) => unknown) => work(db) } };
});
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";

describe("verified guest delivery OTP encrypted outbox", () => {
  const recipient = { kind: "GUEST_CHECKOUT_CONTACT", subjectUserId: "guest-checkout-contact:contact", contactSnapshotId: "contact", email: "guest@example.test", name: "Guest" };
  const input = () => ({ eventType: "DELIVERY_OTP" as const, operationId: "delivery-otp-request", aggregateReference: "courier-order", subjectUserId: recipient.subjectUserId, expiresAt: new Date(Date.now() + 30 * 60_000), values: { otp: "573190", name: "Guest", expiresMinutes: 30, orderNumber: "KT-1", orderUrl: "https://example.test/track" } });
  beforeEach(() => {
    mocks.intent = null; mocks.secure = null; mocks.delivery = null;
    mocks.resolve.mockReset().mockResolvedValue(recipient); mocks.user.mockReset(); mocks.send.mockReset().mockResolvedValue({ accepted: true, providerMessageReference: "provider-id" });
    mocks.claim.mockReset().mockResolvedValue({ id: "claim" }); mocks.finish.mockReset().mockResolvedValue({ delivery: { id: "delivery", status: "PROVIDER_ACCEPTED" } });
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("AUTH_OTP_HMAC_KEY", Buffer.alloc(32, 7).toString("base64"));
    mocks.command = { completedAt: new Date(), resultSnapshot: { type: "DELIVERY_OTP_REQUEST", orderId: "courier-order", assignmentId: "assignment", driverProfileId: "driver", createdOtpId: "otp-active" } };
    mocks.otp = { id: "otp-active", attempts: 0, maxAttempts: 5, codeHash: hashOtp("573190"), createdByUserId: "driver-user", assignment: { status: "ACCEPTED", driverProfileId: "driver", order: { status: "IN_TRANSIT", currentDriverProfileId: "driver" }, driverProfile: { userId: "driver-user", status: "ACTIVE", user: { status: "ACTIVE", role: "DRIVER" } } } };
  });
  it("queues and delivers to the verified guest without creating or resolving a synthetic User", async () => {
    const request = input();
    await queueSecurityNotification(request);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.resolve).toHaveBeenCalledWith("courier-order", expect.anything());
    expect(JSON.stringify(mocks.intent)).not.toContain("573190");
    expect(JSON.stringify(mocks.delivery)).not.toContain("573190");
    expect(openSecurityPayload(mocks.secure!.encryptedPayload as string, request.operationId)).toEqual(request.values);
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ accepted: true });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ destination: "guest@example.test", body: "Code: 573190" }));
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("rejects a different subject even when it has a valid seller account", async () => {
    await expect(queueSecurityNotification({ ...input(), subjectUserId: "seller" })).rejects.toMatchObject({ code: "VERIFIED_NOTIFICATION_DESTINATION_REQUIRED" });
    expect(mocks.intent).toBeNull(); expect(mocks.delivery).toBeNull();
  });
  it("delivers a parcel handoff code to its unregistered explicit receiver without account lookup", async () => {
    const shipment = { kind: "SHIPMENT_RECIPIENT", subjectUserId: "delivery-recipient:courier-order:opaque-email-hash", email: "receiver@example.test", name: "Receiver" };
    mocks.resolve.mockResolvedValue(shipment);
    await queueSecurityNotification({ ...input(), subjectUserId: shipment.subjectUserId });
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ accepted: true });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ destination: "receiver@example.test" }));
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("rechecks guest contact revocation before opening the secret or calling the provider", async () => {
    await queueSecurityNotification(input());
    mocks.resolve.mockRejectedValue(new NotificationPolicyError("DELIVERY_RECIPIENT_NOT_RESOLVED"));
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eligibilityReason: "DELIVERY_RECIPIENT_AUTHORITY_REVOKED" }) }));
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not redirect an already queued OTP to a replacement contact", async () => {
    await queueSecurityNotification(input());
    mocks.resolve.mockResolvedValue({ ...recipient, subjectUserId: "guest-checkout-contact:replacement", email: "other@example.test" });
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("skips delayed email A after resend B invalidates its code, then sends only B", async () => {
    await queueSecurityNotification(input());
    const first = { intent: mocks.intent, secure: mocks.secure, delivery: mocks.delivery, command: mocks.command };
    const assignment = mocks.otp!.assignment;
    mocks.intent = null; mocks.secure = null; mocks.delivery = null;
    await queueSecurityNotification({ ...input(), operationId: "replacement-otp-request", values: { ...input().values, otp: "684201" } });
    const second = { intent: mocks.intent, secure: mocks.secure, delivery: mocks.delivery, command: { completedAt: new Date(), resultSnapshot: { type: "DELIVERY_OTP_REQUEST", orderId: "courier-order", assignmentId: "assignment", driverProfileId: "driver", createdOtpId: "otp-replacement" } } };
    mocks.otp = { ...mocks.otp, id: "otp-replacement", codeHash: hashOtp("684201"), assignment };
    Object.assign(mocks, first);
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
    Object.assign(mocks, second);
    await expect(deliverSecurityEmail("delivery")).resolves.toMatchObject({ accepted: true });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ body: "Code: 684201" }));
  });
  it("checks the decrypted code hash at the provider boundary", async () => {
    await queueSecurityNotification(input()); mocks.otp!.codeHash = hashOtp("684201");
    await deliverSecurityEmail("delivery");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ accepted: false, safeCode: "DELIVERY_OTP_NOT_ACTIVE" }));
  });
});
