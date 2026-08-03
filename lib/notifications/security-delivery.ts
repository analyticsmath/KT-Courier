/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is intentionally deferred. */
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { NotificationPolicyError } from "./contracts";

function keyFromEnvironment(): Buffer {
  const raw = process.env.NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new NotificationPolicyError("NOTIFICATION_SECURITY_ENCRYPTION_UNAVAILABLE");
  return key;
}

function seal(value: Record<string, unknown>): string {
  const key = keyFromEnvironment();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `nsecurity:v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

/**
 * The authentication authority owns token generation and verification. This
 * boundary owns only the durable, encrypted delivery intent. Plain OTP or
 * reset values never enter notification receipts, messages, attempts, audit
 * evidence, logs, or the source event safe payload.
 */
export async function queueSecurityNotification(input: {
  eventType: "EMAIL_VERIFICATION_OTP" | "PASSWORD_RESET" | "PASSWORD_CHANGED" | "DELIVERY_OTP";
  operationId: string;
  subjectUserId?: string;
  aggregateReference: string;
  expiresAt?: Date | null;
  values?: Record<string, unknown>;
  allowUnverifiedBootstrapEmail?: boolean;
}) {
  if (!input.operationId || !input.aggregateReference) throw new NotificationPolicyError("INVALID_SECURITY_NOTIFICATION_INTENT");
  const user = input.subjectUserId ? await (prisma as any).user.findUnique({ where: { id: input.subjectUserId }, select: { id: true, email: true, emailVerifiedAt: true, status: true } }) : null;
  if (input.subjectUserId && (!user || !user.email || (!user.emailVerifiedAt && !input.allowUnverifiedBootstrapEmail))) throw new NotificationPolicyError("VERIFIED_NOTIFICATION_DESTINATION_REQUIRED");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new NotificationPolicyError("EXPIRED_SECURITY_NOTIFICATION");
  const safePayload = { subjectUserId: input.subjectUserId ?? null, purpose: "SECURITY", expiresAt: input.expiresAt?.toISOString() ?? null, bootstrap: Boolean(input.allowUnverifiedBootstrapEmail) };
  const db: any = prisma;
  const existing = await db.notificationEventIntent.findUnique({ where: { operationId: input.operationId } });
  if (existing) {
    if (JSON.stringify(existing.safePayload) !== JSON.stringify(safePayload)) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT");
    return { intent: existing, replay: true };
  }
  const intent = await db.notificationEventIntent.create({ data: { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: input.eventType, aggregateReference: input.aggregateReference, operationId: input.operationId, safePayload } });
  if (input.values && Object.keys(input.values).length) {
    await db.notificationSecurePayload.create({ data: { publicReference: `nsec_${createHash("sha256").update(input.operationId).digest("hex").slice(0, 24)}`, eventIntentId: intent.id, encryptedPayload: seal(input.values), keyVersion: "v1", expiresAt: input.expiresAt ?? null } });
  }
  return { intent, replay: false };
}

/** A legacy email call becomes a canonical intent; it never delivers directly. */
export async function queueLegacyEmailIntent(input: { templateType: string; to: string; relatedUserId?: string; relatedOrderId?: string; context: Record<string, unknown> }) {
  const aggregateReference = input.relatedUserId ?? input.relatedOrderId ?? `email-${createHash("sha256").update(input.to).digest("hex").slice(0, 24)}`;
  const operationId = `legacy-email:${input.templateType}:${aggregateReference}:${createHash("sha256").update(JSON.stringify(input.context)).digest("hex").slice(0, 24)}`;
  const security = ["EMAIL_VERIFICATION_OTP", "PASSWORD_RESET", "PASSWORD_CHANGED", "DELIVERY_OTP"].includes(input.templateType);
  if (security && input.relatedUserId) return queueSecurityNotification({ eventType: input.templateType as "EMAIL_VERIFICATION_OTP" | "PASSWORD_RESET" | "PASSWORD_CHANGED" | "DELIVERY_OTP", operationId, subjectUserId: input.relatedUserId, aggregateReference, values: input.context, allowUnverifiedBootstrapEmail: input.templateType === "EMAIL_VERIFICATION_OTP" });
  const db: any = prisma;
  const safePayload = { purpose: input.templateType === "CONTACT_RECEIVED" ? "TRANSACTIONAL" : "OPERATIONAL", legacyTemplateType: input.templateType };
  const existing = await db.notificationEventIntent.findUnique({ where: { operationId } });
  if (existing) return { intent: existing, replay: true };
  const intent = await db.notificationEventIntent.create({ data: { sourceAuthority: "LEGACY_EMAIL_ADAPTER", eventType: input.templateType, aggregateReference, operationId, safePayload } });
  return { intent, replay: false };
}
