import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { renderTemplate } from "@/lib/email/email-templates";
import { EmailTemplateType } from "@/types/db";
import {
  nextRetryAt,
  NotificationPolicyError,
  type FailureClass,
} from "./contracts";
import { assertNotificationProductionReady } from "./production-readiness";
import { ResendEmailProvider } from "./providers";
import { openSecurityPayload } from "./security-payload-vault";

const TEMPLATE_BY_EVENT: Record<string, EmailTemplateType> = {
  EMAIL_VERIFICATION_OTP: EmailTemplateType.EMAIL_VERIFICATION_OTP,
  PASSWORD_RESET: EmailTemplateType.PASSWORD_RESET,
  PASSWORD_CHANGED: EmailTemplateType.PASSWORD_CHANGED,
  DELIVERY_OTP: EmailTemplateType.DELIVERY_OTP,
};

function attemptReference(deliveryId: string, attemptNumber: number): string {
  return `nattempt_${createHash("sha256")
    .update(`${deliveryId}:${attemptNumber}`)
    .digest("hex")
    .slice(0, 24)}`;
}

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
    delivery = await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "EXPIRED", nextAttemptAt: null },
    });
    return { accepted: false, status: delivery.status, deliveryId: delivery.id };
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

  const claim = await prisma.notificationDelivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: ["QUEUED", "FAILED_RETRYABLE"] },
    },
    data: { status: "SENDING" },
  });

  if (!claim.count) {
    const current = await prisma.notificationDelivery.findUnique({
      where: { id: delivery.id },
    });
    if (!current) {
      throw new NotificationPolicyError("SECURITY_EMAIL_DELIVERY_NOT_FOUND");
    }
    return {
      accepted: acceptedStatus(current.status),
      status: current.status,
      deliveryId: current.id,
    };
  }

  const attemptNumber =
    (await prisma.notificationDeliveryAttempt.count({
      where: { deliveryId: delivery.id },
    })) + 1;

  const attempt = await prisma.notificationDeliveryAttempt.create({
    data: {
      publicReference: attemptReference(delivery.id, attemptNumber),
      deliveryId: delivery.id,
      attemptNumber,
      operationId: `${intent.operationId}:email-attempt:${attemptNumber}`,
      provider: "RESEND_EMAIL",
      status: "STARTED",
    },
  });

  let result:
    | {
        accepted: boolean;
        providerMessageReference?: string;
        failureClass?: FailureClass;
        safeCode?: string;
        retryAfterSeconds?: number;
      }
    | undefined;

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

  const failure = result.failureClass ?? "UNKNOWN_PROVIDER_FAILURE";
  const retryAt = result.accepted
    ? null
    : nextRetryAt({
        failure,
        attemptNumber,
        retryAfterSeconds: result.retryAfterSeconds,
        expiresAt,
      });

  await prisma.$transaction([
    prisma.notificationDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: result.accepted ? "PROVIDER_ACCEPTED" : "FAILED",
        completedAt: new Date(),
        providerMessageReference: result.providerMessageReference ?? null,
        failureClass: result.accepted ? null : failure,
        safeProviderCode: result.safeCode ?? null,
        nextAttemptAt: retryAt,
      },
    }),
    prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.accepted
          ? "PROVIDER_ACCEPTED"
          : retryAt
            ? "FAILED_RETRYABLE"
            : "FAILED_PERMANENT",
        provider: "RESEND_EMAIL",
        providerMessageReference: result.providerMessageReference ?? null,
        nextAttemptAt: retryAt,
      },
    }),
  ]);

  return {
    accepted: result.accepted,
    status: result.accepted
      ? "PROVIDER_ACCEPTED"
      : retryAt
        ? "FAILED_RETRYABLE"
        : "FAILED_PERMANENT",
    deliveryId: delivery.id,
  };
}
