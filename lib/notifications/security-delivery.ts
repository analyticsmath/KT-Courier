import { createHash, createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotificationPolicyError } from "./contracts";
import { canonicalSecurityValues, openSecurityPayload, sealSecurityPayload, securityPayloadKey } from "./security-payload-vault";

/**
 * Authentication owns token generation and verification. This boundary owns
 * only durable encrypted delivery intents. Private token values never enter
 * source receipts, messages, attempts, audit evidence or logs.
 */
export type SecurityNotificationInput = {
  eventType: "EMAIL_VERIFICATION_OTP" | "PASSWORD_RESET" | "PASSWORD_CHANGED" | "DELIVERY_OTP";
  operationId: string;
  subjectUserId?: string;
  aggregateReference: string;
  expiresAt?: Date | null;
  values?: Record<string, unknown>;
  allowUnverifiedBootstrapEmail?: boolean;
};

export async function queueSecurityNotification(input: SecurityNotificationInput, transaction?: Prisma.TransactionClient) {
  if (!input.operationId || input.operationId.length > 160 || !input.aggregateReference || input.aggregateReference.length > 160 || !input.subjectUserId) throw new NotificationPolicyError("INVALID_SECURITY_NOTIFICATION_INTENT");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new NotificationPolicyError("EXPIRED_SECURITY_NOTIFICATION");
  const bootstrap = input.eventType === "EMAIL_VERIFICATION_OTP" && input.allowUnverifiedBootstrapEmail === true;
  const metadata = { subjectUserId: input.subjectUserId, purpose: "SECURITY", expiresAt: input.expiresAt?.toISOString() ?? null, bootstrap };
  const values = canonicalSecurityValues(input.values ?? {});
  const requestFingerprint = createHmac("sha256", securityPayloadKey()).update(JSON.stringify({ ...metadata, eventType: input.eventType, aggregateReference: input.aggregateReference, values })).digest("hex");
  // Encryption must succeed before inserting any durable source intent.
  const encryptedPayload = sealSecurityPayload(input.values ?? {}, input.operationId);

  const work = async (tx: Prisma.TransactionClient) => {
    // Serialize concurrent retries of exactly this operation, including empty first attempts.
    await tx.$queryRaw`SELECT (pg_advisory_xact_lock(hashtextextended(${`security-notification:${input.operationId}`}, 0)) IS NULL) AS locked`;
    const user = await tx.user.findUnique({ where: { id: input.subjectUserId }, select: { id: true, email: true, emailVerifiedAt: true, status: true } });
    if (!user?.email || !(user.status === "ACTIVE" || (bootstrap && user.status === "PENDING_VERIFICATION")) || (!user.emailVerifiedAt && !bootstrap)) throw new NotificationPolicyError("VERIFIED_NOTIFICATION_DESTINATION_REQUIRED");
    const existing = await tx.notificationEventIntent.findUnique({ where: { operationId: input.operationId } });
    if (existing) {
      const safe = existing.safePayload as Record<string, unknown> | null;
      const secure = await tx.notificationSecurePayload.findUnique({ where: { eventIntentId: existing.id } });
      const matchingPayload = secure && canonicalSecurityValues(openSecurityPayload(secure.encryptedPayload, input.operationId)) === values;
      if (existing.sourceAuthority !== "AUTHENTICATION_SECURITY" || existing.eventType !== input.eventType || existing.aggregateReference !== input.aggregateReference || !safe || safe.subjectUserId !== metadata.subjectUserId || safe.expiresAt !== metadata.expiresAt || safe.bootstrap !== metadata.bootstrap || (safe.requestFingerprint && safe.requestFingerprint !== requestFingerprint) || !matchingPayload) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT");
      return { intent: existing, replay: true };
    }
    const intent = await tx.notificationEventIntent.create({ data: { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: input.eventType, aggregateReference: input.aggregateReference, operationId: input.operationId, safePayload: { ...metadata, requestFingerprint } } });
    await tx.notificationSecurePayload.create({ data: { publicReference: `nsec_${createHash("sha256").update(input.operationId).digest("hex").slice(0, 24)}`, eventIntentId: intent.id, encryptedPayload, keyVersion: "v2", expiresAt: input.expiresAt ?? null } });
    return { intent, replay: false };
  };
  return transaction ? work(transaction) : prisma.$transaction(work);
}

/** A legacy email call becomes a canonical intent; it never delivers directly. */
export async function queueLegacyEmailIntent(input: { templateType: string; to: string; relatedUserId?: string; relatedOrderId?: string; context: Record<string, unknown> }) {
  const aggregateReference = input.relatedUserId ?? input.relatedOrderId ?? `email-${createHash("sha256").update(input.to).digest("hex").slice(0, 24)}`;
  const operationId = `legacy-email:${input.templateType}:${aggregateReference}:${createHash("sha256").update(JSON.stringify(input.context)).digest("hex").slice(0, 24)}`;
  const security = ["EMAIL_VERIFICATION_OTP", "PASSWORD_RESET", "PASSWORD_CHANGED", "DELIVERY_OTP"].includes(input.templateType);
  if (security && input.relatedUserId) return queueSecurityNotification({ eventType: input.templateType as "EMAIL_VERIFICATION_OTP" | "PASSWORD_RESET" | "PASSWORD_CHANGED" | "DELIVERY_OTP", operationId, subjectUserId: input.relatedUserId, aggregateReference, values: input.context, allowUnverifiedBootstrapEmail: input.templateType === "EMAIL_VERIFICATION_OTP" });
  const db = prisma;
  const safePayload = { purpose: input.templateType === "CONTACT_RECEIVED" ? "TRANSACTIONAL" : "OPERATIONAL", legacyTemplateType: input.templateType };
  const existing = await db.notificationEventIntent.findUnique({ where: { operationId } });
  if (existing) return { intent: existing, replay: true };
  const intent = await db.notificationEventIntent.create({ data: { sourceAuthority: "LEGACY_EMAIL_ADAPTER", eventType: input.templateType, aggregateReference, operationId, safePayload } });
  return { intent, replay: false };
}
