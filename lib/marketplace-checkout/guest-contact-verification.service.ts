import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateOtpCode, hashOtp, otpExpiresAt } from "@/lib/auth/otp";
import { sealSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { guestContactSubjectKey } from "@/lib/notifications/guest-recipient";
import type { CartOwner } from "./cart.service";
import { MarketplaceCheckoutError } from "./errors";

async function lockGuestContact(tx: Prisma.TransactionClient, reference: string, owner: CartOwner) {
  if (owner.type !== "GUEST") throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Guest checkout access is required.");
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "publicReference" = ${reference} FOR UPDATE`);
  const checkout = await tx.marketplaceCheckout.findFirst({ where: { publicReference: reference, customerUserId: null, guestAccessTokenHash: owner.guestTokenHash }, include: { contactSnapshot: true } });
  if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
  if (!checkout.contactSnapshot || !checkout.contactSnapshot.email) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Save your contact details before verifying your email.");
  return { ...checkout.contactSnapshot, checkoutId: checkout.id };
}

/** Atomic challenge and encrypted email outbox; the code never enters a public DTO or log. */
export async function requestGuestContactVerification(input: { reference: string; owner: CartOwner; operationId: string }) {
  if (!/^[A-Za-z0-9_-]{12,120}$/.test(input.operationId)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid verification request.");
  return prisma.$transaction(async (tx) => {
    const contact = await lockGuestContact(tx, input.reference, input.owner);
    const existing = await tx.marketplaceGuestContactVerification.findUnique({ where: { contactSnapshotId_operationId: { contactSnapshotId: contact.id, operationId: input.operationId } } });
    if (existing) {
      if (existing.checkoutId !== contact.checkoutId) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Verification request belongs to a different checkout.");
      return { verificationReference: existing.publicReference, verified: Boolean(existing.verifiedAt), expiresAt: existing.expiresAt.toISOString() };
    }
    const verified = await tx.marketplaceGuestContactVerification.findFirst({ where: { contactSnapshotId: contact.id, checkoutId: contact.checkoutId, verifiedAt: { not: null } } });
    if (verified) return { verificationReference: verified.publicReference, verified: true, expiresAt: verified.expiresAt.toISOString() };
    if (await tx.marketplaceGuestContactVerification.count({ where: { checkoutId: contact.checkoutId, createdAt: { gte: new Date(Date.now() - 3_600_000) } } }) >= 3) throw new MarketplaceCheckoutError("CHECKOUT_VERIFICATION_BLOCKED", "Too many verification requests. Please try again later.");
    const publicReference = `gverify_${createHash("sha256").update(`${contact.id}:${input.operationId}`).digest("hex").slice(0, 32)}`;
    const code = generateOtpCode();
    const codeHash = hashOtp(`${publicReference}:${code}`);
    const expiresAt = otpExpiresAt();
    const operationId = `guest-verification-email:${publicReference}`;
    const encryptedPayload = sealSecurityPayload({ name: contact.recipientName, otp: code, expiresMinutes: 15 }, operationId);
    await tx.marketplaceGuestContactVerification.updateMany({ where: { contactSnapshotId: contact.id, verifiedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });
    await tx.marketplaceGuestContactVerification.create({ data: { publicReference, contactSnapshotId: contact.id, checkoutId: contact.checkoutId, operationId: input.operationId, codeHash, expiresAt } });
    const intent = await tx.notificationEventIntent.create({ data: { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "GUEST_CHECKOUT_EMAIL_VERIFICATION_OTP", aggregateReference: publicReference, operationId, safePayload: { contactSnapshotId: contact.id, subjectUserId: guestContactSubjectKey(contact.id), verificationReference: publicReference } } });
    await tx.notificationSecurePayload.create({ data: { publicReference: `nsec_${createHash("sha256").update(operationId).digest("hex").slice(0, 24)}`, eventIntentId: intent.id, encryptedPayload, keyVersion: "v2", expiresAt } });
    await tx.notificationDelivery.create({ data: { publicReference: `ndel_${createHash("sha256").update(operationId).digest("hex").slice(0, 24)}`, messageId: intent.id, recipientUserId: guestContactSubjectKey(contact.id), channel: "EMAIL", status: "QUEUED", renderedTitle: "Your KT Couriers verification code", renderedBody: "[SECURE CONTENT REDACTED — rendered only at the provider boundary]", expiresAt } });
    return { verificationReference: publicReference, verified: false, expiresAt: expiresAt.toISOString() };
  });
}

export async function verifyGuestContact(input: { reference: string; owner: CartOwner; verificationReference: string; code: string }) {
  if (!/^gverify_[a-f0-9]{32}$/.test(input.verificationReference) || !/^\d{6}$/.test(input.code)) throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid verification code.");
  const outcome = await prisma.$transaction(async (tx) => {
    const contact = await lockGuestContact(tx, input.reference, input.owner);
    const challenge = await tx.marketplaceGuestContactVerification.findUnique({ where: { publicReference: input.verificationReference } });
    if (!challenge || challenge.contactSnapshotId !== contact.id || challenge.checkoutId !== contact.checkoutId) return false;
    if (challenge.verifiedAt) return true;
    if (challenge.expiresAt <= new Date() || challenge.attempts >= 5) return false;
    const expected = Buffer.from(challenge.codeHash, "hex");
    const supplied = Buffer.from(hashOtp(`${challenge.publicReference}:${input.code}`), "hex");
    const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
    await tx.marketplaceGuestContactVerification.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 }, ...(matches ? { verifiedAt: new Date() } : {}) } });
    return matches;
  });
  // Throw after committing the failed attempt, so retries cannot reset the bound.
  if (!outcome) throw new MarketplaceCheckoutError("CHECKOUT_VERIFICATION_INVALID", "The verification code is invalid or expired.");
  return { verified: true as const };
}

export async function getGuestContactVerification(input: { reference: string; owner: CartOwner }) {
  if (input.owner.type === "CUSTOMER") {
    const checkout = await prisma.marketplaceCheckout.findFirst({ where: { publicReference: input.reference, customerUserId: input.owner.userId }, select: { id: true } });
    if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    return { required: false, verified: true };
  }
  return prisma.$transaction(async (tx) => {
    const contact = await lockGuestContact(tx, input.reference, input.owner);
    const verified = await tx.marketplaceGuestContactVerification.findFirst({ where: { contactSnapshotId: contact.id, checkoutId: contact.checkoutId, verifiedAt: { not: null } } });
    const disabled = await tx.notificationPreference.findFirst({ where: { userId: guestContactSubjectKey(contact.id), channel: "EMAIL", categoryKey: { in: guestNotificationCategories }, mode: "DISABLED" } });
    return { required: true, verified: Boolean(verified), emailUpdatesEnabled: !disabled };
  });
}

const guestNotificationCategories = ["MARKETPLACE_ORDER_STATUS", "STORE_ORDER_STATUS", "PAYMENT_STATUS", "REFUND_STATUS"];
export async function setGuestNotificationPreference(input: { reference: string; owner: CartOwner; enabled: boolean }) {
  return prisma.$transaction(async (tx) => {
    const contact = await lockGuestContact(tx, input.reference, input.owner);
    const userId = guestContactSubjectKey(contact.id);
    for (const categoryKey of guestNotificationCategories) await tx.notificationPreference.upsert({ where: { userId_categoryKey_channel: { userId, categoryKey, channel: "EMAIL" } }, create: { userId, categoryKey, channel: "EMAIL", mode: input.enabled ? "ENABLED" : "DISABLED" }, update: { mode: input.enabled ? "ENABLED" : "DISABLED" } });
    return { emailUpdatesEnabled: input.enabled };
  });
}
