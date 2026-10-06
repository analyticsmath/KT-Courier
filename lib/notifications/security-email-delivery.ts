import { prisma } from "@/lib/db/prisma";
import { renderTemplate } from "@/lib/email/email-templates";
import { EmailTemplateType } from "@/types/db";
import {
  NotificationPolicyError,
} from "./contracts";
import { assertNotificationProductionReady } from "./production-readiness";
import { ResendEmailProvider } from "./providers";
import { openSecurityPayload } from "./security-payload-vault";
import { claimEmailAttempt, finishEmailAttempt } from "./email-delivery-recovery";
import type { ProviderSendResult } from "./providers";

const TEMPLATE_BY_EVENT: Record<string, EmailTemplateType> = {
  EMAIL_VERIFICATION_OTP: EmailTemplateType.EMAIL_VERIFICATION_OTP,
  PASSWORD_RESET: EmailTemplateType.PASSWORD_RESET,
  PASSWORD_CHANGED: EmailTemplateType.PASSWORD_CHANGED,
  DELIVERY_OTP: EmailTemplateType.DELIVERY_OTP,
};

function acceptedStatus(status: string): boolean {
  return status === "PROVIDER_ACCEPTED" || status === "DELIVERED";
}

/**
 * Sends one encrypted authentication/security email.
 *
 * The secret payload is opened only after this worker has atomically claimed the
 * delivery. The OTP/reset secret is rendered in memory and is never copied into
 * NotificationDelivery, NotificationDeliveryAttempt, logs or reconciliation
 * evidence.
 */
export async function deliverSecurityEmail(deliveryId: string) {
  assertNotificationProductionReady();

  let delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!delivery || delivery.channel !== "EMAIL") {
    throw new NotificationPolicyError("SECURITY_EMAIL_DELIVERY_NOT_FOUND");
  }

  if (acceptedStatus(delivery.status)) {
    return { accepted: true, status: delivery.status, deliveryId: delivery.id };
  }

  const intent = await prisma.notificationEventIntent.findUnique({
    where: { id: delivery.messageId },
  });
  if (!intent || intent.sourceAuthority !== "AUTHENTICATION_SECURITY") {
    throw new NotificationPolicyError("INVALID_SECURITY_EMAIL_INTENT");
  }

  const secure = await prisma.notificationSecurePayload.findUnique({
    where: { eventIntentId: intent.id },
  });
  if (!secure) {
    throw new NotificationPolicyError("SECURITY_EMAIL_PAYLOAD_NOT_FOUND");
  }

  const expiresAt = secure.expiresAt ?? delivery.expiresAt;
  if (expiresAt && expiresAt <= new Date()) {
    await prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: { in: ["QUEUED", "FAILED_RETRYABLE"] } },
      data: { status: "EXPIRED", nextAttemptAt: null },
    });
    delivery = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    return { accepted: acceptedStatus(delivery.status), status: delivery.status, deliveryId: delivery.id };
  }

  if (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()) {
    return { accepted: false, status: delivery.status, deliveryId: delivery.id };
  }

  const safe = intent.safePayload as Record<string, unknown> | null;
  const subjectUserId =
    safe && typeof safe.subjectUserId === "string"
      ? safe.subjectUserId
      : undefined;
  if (!subjectUserId || subjectUserId !== delivery.recipientUserId) {
    throw new NotificationPolicyError("SECURITY_EMAIL_RECIPIENT_MISMATCH");
  }

  const user = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, email: true, status: true, emailVerifiedAt: true },
  });
  if (!user?.email) {
    throw new NotificationPolicyError("SECURITY_EMAIL_RECIPIENT_NOT_FOUND");
  }

  const templateType = TEMPLATE_BY_EVENT[intent.eventType];
  if (!templateType) {
    throw new NotificationPolicyError("SECURITY_EMAIL_TEMPLATE_NOT_SUPPORTED");
  }

  const claim = await claimEmailAttempt(prisma, { deliveryId: delivery.id, provider: "RESEND_EMAIL", operationId: `${intent.operationId}:email-attempt` });
  if (!claim) {
    const current = await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    return { accepted: acceptedStatus(current.status), status: current.status, deliveryId: current.id };
  }
  let result: ProviderSendResult;

  try {
    const values = openSecurityPayload(
      secure.encryptedPayload,
      intent.operationId,
    );
    const rendered = renderTemplate(templateType, values);
    const provider = new ResendEmailProvider();

    result = await provider.send({
      destination: user.email,
      subject: rendered.subject,
      body: rendered.text,
      htmlBody: rendered.html,
      replyTo: process.env.EMAIL_REPLY_TO,
      // Stable across uncertain network retries so provider idempotency prevents
      // duplicate security messages for the same immutable delivery.
      idempotencyKey: delivery.publicReference,
    });
  } catch {
    result = {
      accepted: false,
      failureClass: "CONFIGURATION_FAILURE",
      safeCode: "SECURITY_EMAIL_RENDER_OR_PROVIDER_FAILURE",
    };
  }

  const { delivery: finished } = await finishEmailAttempt(prisma, claim, result);
  return { accepted: acceptedStatus(finished.status), status: finished.status, deliveryId: finished.id };
}
