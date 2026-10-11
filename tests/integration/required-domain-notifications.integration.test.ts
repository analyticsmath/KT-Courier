import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { prepareRequiredDomainNotifications, reviewRequiredDomainNotification } from "@/lib/notifications/required-domain-configuration";
import { requiredDomainNotificationDefinitions } from "@/lib/notifications/required-domain-definitions";
import { appendRequiredDomainNotificationIntents } from "@/lib/notifications/required-domain-intake";
import { consumeCustomerOrderNotifications } from "@/lib/notifications/customer-order-publication";
import { requestGuestContactVerification, verifyGuestContact } from "@/lib/marketplace-checkout/guest-contact-verification.service";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { guestContactSubjectKey } from "@/lib/notifications/guest-recipient";
import { deliverQueuedEmails } from "@/lib/notifications/queued-email-delivery";
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: () => {} }));

describe("durable required-domain notification intake on disposable PostgreSQL", () => {
  const prefix = `required-notification-${randomUUID()}`;
  const definition = requiredDomainNotificationDefinitions.find((entry) => entry.eventType === "PAYMENT_STATUS_CHANGED")!;
  let routeId = ""; let templateId = ""; let userId = ""; let orderId = ""; let paymentId = "";
  let recipientSubjects: string[] = [];
  const review = (action: Parameters<typeof reviewRequiredDomainNotification>[2], actor = "reviewer") => prisma.$transaction((tx) => reviewRequiredDomainNotification(tx, definition.eventType, action, `${prefix}-${actor}`));
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
    await prisma.$transaction(prepareRequiredDomainNotifications);
    routeId = (await prisma.notificationEventRoute.findUniqueOrThrow({ where: { key: definition.routeKey } })).id;
    templateId = (await prisma.notificationTemplate.findUniqueOrThrow({ where: { key: definition.templateKey } })).id;
  });
  beforeEach(async () => {
    await prisma.notificationEventRouteVersion.deleteMany({ where: { routeId } });
    await prisma.notificationTemplateVersion.updateMany({ where: { templateId }, data: { status: "UNDER_REVIEW", approvedByUserId: null, approvedAt: null, publishedAt: null } });
    await prisma.notificationRecipientPolicyVersion.updateMany({ where: { key: definition.recipientPolicyKey }, data: { status: "DRAFT", approvedByUserId: null, approvedAt: null } });
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } }); userId = user.id; recipientSubjects = [userId];
    const order = await prisma.order.create({ data: { orderNumber: `${prefix}-${randomUUID()}`, customerId: userId, source: "CUSTOMER", deliveryType: "SAME_DAY" } }); orderId = order.id;
    // A failed test payment carries no success or ledger evidence and no real money.
    const payment = await prisma.payment.create({ data: { publicReference: `pay_${randomUUID()}`, userId, orderId, status: "FAILED", amount: "123.45", creationIdempotencyKey: randomUUID(), creationRequestHash: "a".repeat(64) } }); paymentId = payment.id;
  });
  afterEach(async () => {
    const histories = await prisma.paymentStatusHistory.findMany({ where: { paymentId }, select: { id: true } });
    const operations = histories.map((history) => `payment-status-notification:${history.id}`);
    const receipts = await prisma.notificationSourceReceipt.findMany({ where: { OR: [{ sourceEventId: { in: operations } }, { sourceEventId: { startsWith: prefix } }] }, select: { id: true } });
    await prisma.notificationInboxItem.deleteMany({ where: { ownerUserId: { in: recipientSubjects } } });
    await prisma.notificationDelivery.deleteMany({ where: { recipientUserId: { in: recipientSubjects } } });
    await prisma.notificationRecipient.deleteMany({ where: { subjectUserId: { in: recipientSubjects } } });
    await prisma.notificationMessage.deleteMany({ where: { recipientUserId: { in: recipientSubjects } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: recipientSubjects } } });
    await prisma.notificationSuppression.deleteMany({ where: { userId: { in: recipientSubjects } } });
    await prisma.notificationReconciliationCase.deleteMany({ where: { sourceReceiptId: { in: receipts.map((row) => row.id) } } });
    await prisma.notificationSourceReceipt.deleteMany({ where: { id: { in: receipts.map((row) => row.id) } } });
    await prisma.notificationEventIntent.deleteMany({ where: { OR: [{ operationId: { in: operations } }, { operationId: { startsWith: prefix } }] } });
    // Financial history is immutable, including in certification. Keep the
    // owned failed-payment fixtures until the disposable database is destroyed.
    vi.unstubAllEnvs();
  });
  async function activate() {
    await review("APPROVE_RECIPIENT_POLICY"); await review("APPROVE_TEMPLATE"); await review("PUBLISH_TEMPLATE", "publisher");
    await review("PREPARE_ROUTE"); await review("APPROVE_ROUTE"); await review("ACTIVATE_ROUTE", "publisher");
  }
  const history = (createdAt?: Date) => prisma.paymentStatusHistory.create({ data: { paymentId, toStatus: "FAILED", reasonCode: "DISPOSABLE_PROVIDER_REJECTION", ...(createdAt ? { createdAt } : {}) } });
  async function verifiedGuest() {
    vi.stubEnv("AUTH_OTP_HMAC_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const nonce = randomUUID(); const owner = { type: "GUEST" as const, guestTokenHash: `guest-${nonce}` };
    const cart = await prisma.marketplaceCart.create({ data: { publicReference: `notification-cart-${nonce}`, ownerType: "GUEST", guestTokenHash: owner.guestTokenHash } });
    const contact = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: "Disposable guest", email: "verified-guest@example.test", phone: "+27820000000" } });
    const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `notification-checkout-${nonce}`, cartId: cart.id, guestAccessTokenHash: owner.guestTokenHash, contactSnapshotId: contact.id } });
    const challenge = await requestGuestContactVerification({ reference: checkout.publicReference, owner, operationId: `${prefix}-${nonce}-verify` });
    const intent = await prisma.notificationEventIntent.findUniqueOrThrow({ where: { operationId: `guest-verification-email:${challenge.verificationReference}` } });
    const secure = await prisma.notificationSecurePayload.findUniqueOrThrow({ where: { eventIntentId: intent.id } });
    const code = openSecurityPayload(secure.encryptedPayload, intent.operationId).otp as string;
    expect(await verifyGuestContact({ reference: checkout.publicReference, owner, verificationReference: challenge.verificationReference, code })).toEqual({ verified: true });
    // Verification has already been exercised; keep this suite at the queue
    // boundary so it cannot accidentally contact an external provider.
    await prisma.notificationDelivery.updateMany({ where: { messageId: intent.id }, data: { status: "CANCELLED" } });
    const payment = await prisma.payment.create({ data: { publicReference: `pay_${nonce}`, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: checkout.id, status: "FAILED", amount: "123.45", creationIdempotencyKey: randomUUID(), creationRequestHash: "a".repeat(64) } });
    paymentId = payment.id;
    const subject = guestContactSubjectKey(contact.id); recipientSubjects.push(subject);
    return { checkout, subject };
  }
  it("prepares idempotent drafts for every required domain without approval or activation", async () => {
    await prisma.$transaction(prepareRequiredDomainNotifications);
    const keys = requiredDomainNotificationDefinitions.filter((entry) => entry.sourceAuthority !== "LEGACY_ORDER").map((entry) => entry.templateKey);
    expect(await prisma.notificationTemplate.count({ where: { key: { in: keys } } })).toBe(keys.length);
    expect(await prisma.notificationEventRouteVersion.count({ where: { routeId } })).toBe(0);
    await history(); expect(await prisma.$transaction((tx) => appendRequiredDomainNotificationIntents(tx, 50))).toBe(0);
  });
  it("preserves independent publishing and route activation actors", async () => {
    await review("APPROVE_RECIPIENT_POLICY"); await review("APPROVE_TEMPLATE");
    await expect(review("PUBLISH_TEMPLATE")).rejects.toMatchObject({ code: "TEMPLATE_APPROVAL_SEPARATION_REQUIRED" });
    await review("PUBLISH_TEMPLATE", "publisher"); await review("PREPARE_ROUTE"); await review("APPROVE_ROUTE");
    await expect(review("ACTIVATE_ROUTE")).rejects.toMatchObject({ code: "ROUTE_APPROVAL_SEPARATION_REQUIRED" });
    expect(await prisma.notificationEventRouteVersion.findFirst({ where: { routeId } })).toMatchObject({ status: "APPROVED" });
  });
  it("materializes post-activation canonical history once across concurrent consumers", async () => {
    await activate(); const source = await history();
    const results = await Promise.all([consumeCustomerOrderNotifications(50), consumeCustomerOrderNotifications(50)]);
    expect(results.reduce((sum, result) => sum + result.itemsCompleted, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.itemsRetried, 0)).toBe(0);
    expect(await prisma.notificationEventIntent.count({ where: { operationId: `payment-status-notification:${source.id}` } })).toBe(1);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: userId } })).toBe(1);
    expect(await prisma.notificationDelivery.findFirst({ where: { recipientUserId: userId, channel: "EMAIL" } })).toMatchObject({ status: "QUEUED" });
    expect(await prisma.notificationInboxItem.findFirst({ where: { ownerUserId: userId } })).toMatchObject({ body: expect.stringContaining("failed") });
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
  it("does not backfill history preceding the first approved route activation", async () => {
    const old = await history(new Date("2020-01-01")); await activate(); const fresh = await history();
    await consumeCustomerOrderNotifications(50);
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: `payment-status-notification:${old.id}` } })).toBeNull();
    expect(await prisma.notificationEventIntent.findUnique({ where: { operationId: `payment-status-notification:${fresh.id}` } })).not.toBeNull();
  });
  it("reconciles missing canonical source evidence once without dispatch or perpetual retry", async () => {
    await activate();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const operationId = `${prefix}-invalid-source`;
    await prisma.notificationEventIntent.create({ data: { sourceAuthority: "PAYMENT", eventType: definition.eventType, aggregateReference: payment.publicReference, operationId, safePayload: { sourceEventId: "absent-history", customerUserId: userId, email: "spoofed@example.test" } } });
    expect((await consumeCustomerOrderNotifications(50)).itemsReconciled).toBe(1);
    expect(await prisma.notificationSourceReceipt.findFirst({ where: { sourceEventId: operationId } })).toMatchObject({ status: "RECONCILIATION_REQUIRED" });
    expect(await prisma.notificationReconciliationCase.findFirst({ where: { sourceReceiptId: (await prisma.notificationSourceReceipt.findFirstOrThrow({ where: { sourceEventId: operationId } })).id } })).toMatchObject({ reason: "RECEIPT_MISMATCH", safeEvidence: { reasonCode: "CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID" } });
    expect(await prisma.notificationDelivery.count({ where: { recipientUserId: userId } })).toBe(0);
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
  it("keeps the account inbox but blocks email to an unverified account", async () => {
    await activate(); await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: null } }); await history();
    expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: userId } })).toBe(1);
    expect(await prisma.notificationDelivery.findFirstOrThrow({ where: { recipientUserId: userId, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "VERIFIED_NOTIFICATION_DESTINATION_REQUIRED" });
  });
  it("reconciles a forged duplicate operation without repeating the canonical notification", async () => {
    await activate(); const source = await history();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const operationId = `${prefix}-${randomUUID()}-forged-duplicate`;
    await prisma.notificationEventIntent.create({ data: { sourceAuthority: "PAYMENT", eventType: definition.eventType, aggregateReference: payment.publicReference, operationId, safePayload: { sourceEventId: source.id, email: "spoofed@example.test", customerUserId: "foreign-owner" } } });
    const result = await consumeCustomerOrderNotifications(50);
    expect(result.itemsCompleted).toBe(1); expect(result.itemsReconciled).toBe(1); expect(result.itemsRetried).toBe(0);
    expect(await prisma.notificationSourceReceipt.findFirstOrThrow({ where: { sourceEventId: operationId } })).toMatchObject({ status: "RECONCILIATION_REQUIRED" });
    expect(await prisma.notificationMessage.count({ where: { recipientUserId: userId } })).toBe(1);
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: userId } })).toBe(1);
    expect(await prisma.notificationDelivery.count({ where: { recipientUserId: userId, channel: "EMAIL", status: "QUEUED" } })).toBe(1);
    expect((await consumeCustomerOrderNotifications(50)).itemsExamined).toBe(0);
  });
  it.each(["preference", "suppression"] as const)("honours canonical %s while publishing the owned inbox item", async (restriction) => {
    await activate();
    if (restriction === "preference") await prisma.notificationPreference.create({ data: { userId, categoryKey: definition.categoryKey, channel: "EMAIL", mode: "DISABLED" } });
    else await prisma.notificationSuppression.create({ data: { publicReference: `${prefix}-${randomUUID()}`, userId, channel: "EMAIL", purpose: "TRANSACTIONAL", reason: "USER_REVOCATION" } });
    await history(); expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
    expect(await prisma.notificationDelivery.findFirstOrThrow({ where: { recipientUserId: userId, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: restriction === "preference" ? "PREFERENCE_DISABLED" : "SUPPRESSED_DESTINATION" });
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: userId } })).toBe(1);
  });
  it("publishes once to a genuinely verified disposable guest without creating an account or inbox", async () => {
    await activate(); const usersBefore = await prisma.user.count(); const { subject } = await verifiedGuest(); const source = await history();
    const results = await Promise.all([consumeCustomerOrderNotifications(50), consumeCustomerOrderNotifications(50)]);
    expect(results.reduce((sum, result) => sum + result.itemsCompleted, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.itemsRetried, 0)).toBe(0);
    expect(await prisma.notificationEventIntent.count({ where: { operationId: `payment-status-notification:${source.id}` } })).toBe(1);
    expect(await prisma.notificationMessage.count({ where: { recipientUserId: subject } })).toBe(1);
    const message = await prisma.notificationMessage.findFirstOrThrow({ where: { recipientUserId: subject } });
    expect(await prisma.notificationRecipient.findFirstOrThrow({ where: { subjectUserId: subject } })).toMatchObject({ roleProjection: "GUEST_CHECKOUT_CONTACT" });
    expect(await prisma.notificationDelivery.findFirstOrThrow({ where: { messageId: message.id, channel: "EMAIL" } })).toMatchObject({ status: "QUEUED", renderedBody: expect.stringContaining("failed") });
    expect(await prisma.notificationDelivery.findFirstOrThrow({ where: { messageId: message.id, channel: "IN_APP" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "GUEST_HAS_NO_ACCOUNT_INBOX" });
    expect(await prisma.notificationInboxItem.count({ where: { ownerUserId: subject } })).toBe(0); expect(await prisma.user.count()).toBe(usersBefore);
  });
  it("rechecks guest contact authority before sending and blocks a replaced contact", async () => {
    await activate(); const { checkout, subject } = await verifiedGuest(); await history();
    expect((await consumeCustomerOrderNotifications(50)).itemsCompleted).toBe(1);
    const message = await prisma.notificationMessage.findFirstOrThrow({ where: { recipientUserId: subject } });
    const replacement = await prisma.marketplaceCheckoutContactSnapshot.create({ data: { recipientName: "Replacement", email: "replacement@example.test", phone: "+27820000000" } });
    await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { contactSnapshotId: replacement.id } });
    const result = await deliverQueuedEmails(50); expect(result.itemsRetried).toBe(0); expect(result.itemsCompleted).toBe(0);
    expect(await prisma.notificationDelivery.findFirstOrThrow({ where: { messageId: message.id, channel: "EMAIL" } })).toMatchObject({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "RECIPIENT_NOT_ELIGIBLE", providerMessageReference: null });
    const deliveries = await prisma.notificationDelivery.findMany({ where: { recipientUserId: subject }, select: { id: true } });
    expect(await prisma.notificationDeliveryAttempt.count({ where: { deliveryId: { in: deliveries.map((delivery) => delivery.id) } } })).toBe(0);
  });
});
