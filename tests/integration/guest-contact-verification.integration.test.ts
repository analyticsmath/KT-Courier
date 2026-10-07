import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requestGuestContactVerification, verifyGuestContact, getGuestContactVerification, setGuestNotificationPreference } from "@/lib/marketplace-checkout/guest-contact-verification.service";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { guestContactSubjectKey, resolveVerifiedGuestContact } from "@/lib/notifications/guest-recipient";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";
const send = vi.hoisted(() => vi.fn(async (input: { destination: string; body: string }) => ({ accepted: Boolean(input.destination && input.body), providerReference: "disposable-accepted" })));
vi.mock("@/lib/notifications/providers", () => ({ ResendEmailProvider: class { send = send; } }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => {} }));

describe("guest contact verification on disposable PostgreSQL", () => {
  const contacts: string[] = []; let cartId = ""; let checkoutId = "";
  let reference = ""; let contactId = "";
  const owner = { type: "GUEST" as const, guestTokenHash: "disposable-guest-verification" };
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Disposable closure database required.");
  });
  beforeEach(async () => {
    vi.stubEnv("AUTH_OTP_HMAC_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const nonce = randomUUID(); reference = `guest-verification-${nonce}`;
    const cart = await prisma.marketplaceCart.create({ data: { publicReference: `verification-cart-${nonce}`, ownerType: "GUEST", guestTokenHash: owner.guestTokenHash } }); cartId = cart.id;
    const contact = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: "Disposable guest", email: "guest@example.test", phone: "+27820000000" } }); contactId = contact.id; contacts.push(contact.id);
    const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: reference, cartId, guestAccessTokenHash: owner.guestTokenHash, contactSnapshotId: contact.id } }); checkoutId = checkout.id;
  });
  afterEach(async () => {
    const intents = await prisma.notificationEventIntent.findMany({ where: { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "GUEST_CHECKOUT_EMAIL_VERIFICATION_OTP", OR: contacts.map((id) => ({ safePayload: { path: ["contactSnapshotId"], equals: id } })) } });
    const ids = intents.map((intent) => intent.id);
    const deliveries = await prisma.notificationDelivery.findMany({ where: { messageId: { in: ids } }, select: { id: true } });
    await prisma.notificationDeliveryAttempt.deleteMany({ where: { deliveryId: { in: deliveries.map((delivery) => delivery.id) } } });
    await prisma.notificationDelivery.deleteMany({ where: { messageId: { in: ids } } });
    await prisma.notificationSecurePayload.deleteMany({ where: { eventIntentId: { in: ids } } });
    await prisma.notificationEventIntent.deleteMany({ where: { id: { in: ids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: contacts.map(guestContactSubjectKey) } } });
    await prisma.marketplaceGuestContactVerification.deleteMany({ where: { checkoutId } });
    await prisma.marketplaceCheckout.delete({ where: { id: checkoutId } });
    await prisma.marketplaceCart.delete({ where: { id: cartId } });
    await prisma.marketplaceCheckoutContactSnapshot.deleteMany({ where: { id: { in: contacts } } }); contacts.length = 0;
  });
  const request = (operationId = `verify-${randomUUID()}`) => requestGuestContactVerification({ reference, owner, operationId });
  async function challenge() {
    const result = await request();
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: `guest-verification-email:${result.verificationReference}` } });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    const code = openSecurityPayload(secure.encryptedPayload, intent.operationId).otp as string;
    return { result, intent, code };
  }
  it("commits one challenge and encrypted outbox across concurrent retries, without an account", async () => {
    const operationId = `same-${randomUUID()}`;
    const usersBefore = await prisma.user.count();
    const results = await Promise.all([request(operationId), request(operationId), request(operationId)]);
    expect(new Set(results.map((result) => result.verificationReference)).size).toBe(1);
    expect(await prisma.marketplaceGuestContactVerification.count({ where: { checkoutId } })).toBe(1);
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: `guest-verification-email:${results[0].verificationReference}` } });
    expect(intent.safePayload).toEqual({ contactSnapshotId: contactId, subjectUserId: guestContactSubjectKey(contactId), verificationReference: results[0].verificationReference });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    const code = openSecurityPayload(secure.encryptedPayload, intent.operationId).otp as string;
    expect(JSON.stringify(results)).not.toContain(code);
    expect(JSON.stringify(intent.safePayload)).not.toContain(code);
    expect(await prisma.user.count()).toBe(usersBefore);
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { messageId: intent.id } });
    expect(delivery.renderedBody).not.toContain(code);
    await deliverSecurityEmail(delivery.id); await deliverSecurityEmail(delivery.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ destination: "guest@example.test", body: expect.stringContaining(code) });
    expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).renderedBody).not.toContain(code);
  });
  it("commits failed attempts and refuses the correct code after five failures", async () => {
    const { result, code } = await challenge();
    const wrong = code === "000000" ? "999999" : "000000";
    for (let attempt = 0; attempt < 5; attempt++) await expect(verifyGuestContact({ reference, owner, verificationReference: result.verificationReference, code: wrong })).rejects.toMatchObject({ code: "CHECKOUT_VERIFICATION_INVALID" });
    expect(await prisma.marketplaceGuestContactVerification.findUnique({ where: { publicReference: result.verificationReference } })).toMatchObject({ attempts: 5, verifiedAt: null });
    await expect(verifyGuestContact({ reference, owner, verificationReference: result.verificationReference, code })).rejects.toMatchObject({ code: "CHECKOUT_VERIFICATION_INVALID" });
  });
  it("denies foreign owners, then verifies the current contact and honours email preferences", async () => {
    const { result, code } = await challenge();
    await expect(verifyGuestContact({ reference, owner: { ...owner, guestTokenHash: "foreign" }, verificationReference: result.verificationReference, code })).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
    expect(await getGuestContactVerification({ reference, owner })).toMatchObject({ verified: false });
    expect(await verifyGuestContact({ reference, owner, verificationReference: result.verificationReference, code })).toEqual({ verified: true });
    expect(await resolveVerifiedGuestContact(prisma, contactId)).toMatchObject({ userId: guestContactSubjectKey(contactId), verifiedEmail: true });
    await setGuestNotificationPreference({ reference, owner, enabled: false });
    expect(await getGuestContactVerification({ reference, owner })).toMatchObject({ verified: true, emailUpdatesEnabled: false });
    expect(await prisma.notificationPreference.count({ where: { userId: guestContactSubjectKey(contactId), mode: "DISABLED" } })).toBe(4);
  });
  it("revokes old recipient authority after contact replacement and blocks stale queued verification", async () => {
    const old = await challenge();
    const replacement = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: "New guest", email: "replacement@example.test", phone: "+27820000000" } }); contacts.push(replacement.id);
    await prisma.marketplaceCheckout.update({ where: { id: checkoutId }, data: { contactSnapshotId: replacement.id } });
    await expect(verifyGuestContact({ reference, owner, verificationReference: old.result.verificationReference, code: old.code })).rejects.toMatchObject({ code: "CHECKOUT_VERIFICATION_INVALID" });
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { messageId: old.intent.id } });
    expect(await deliverSecurityEmail(delivery.id)).toMatchObject({ status: "ELIGIBILITY_BLOCKED" });
    expect(send).not.toHaveBeenCalled();
    await expect(resolveVerifiedGuestContact(prisma, contactId)).rejects.toMatchObject({ code: "RECIPIENT_NOT_RESOLVED" });
  });
  it("bounds resends across replaced contacts and rolls back when encryption is unavailable", async () => {
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", "");
    await expect(request()).rejects.toMatchObject({ code: "NOTIFICATION_SECURITY_ENCRYPTION_UNAVAILABLE" });
    expect(await prisma.marketplaceGuestContactVerification.count({ where: { checkoutId } })).toBe(0);
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    await request(); await request(); await request();
    const replacement = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: "New guest", email: "replacement@example.test", phone: "+27820000000" } }); contacts.push(replacement.id);
    await prisma.marketplaceCheckout.update({ where: { id: checkoutId }, data: { contactSnapshotId: replacement.id } });
    await expect(request()).rejects.toMatchObject({ code: "CHECKOUT_VERIFICATION_BLOCKED" });
    expect(await prisma.marketplaceGuestContactVerification.count({ where: { checkoutId } })).toBe(3);
  });
});
