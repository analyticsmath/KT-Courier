import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assertNotificationProductionReady } from "./production-readiness";
import { ResendEmailProvider, type NotificationProvider } from "./providers";

/** Explicit administrator diagnostic, not a business-event or delivery receipt. */
export async function sendAdminEmailDiagnostic(actorUserId: string, recipient: string, providerFactory: () => NotificationProvider = () => new ResendEmailProvider()) {
  assertNotificationProductionReady();
  const user = await prisma.user.findFirst({ where: { email: { equals: recipient.trim(), mode: "insensitive" }, status: "ACTIVE", emailVerifiedAt: { not: null } }, select: { id: true, email: true } });
  if (!user) return { accepted: false, delivered: false, message: "Choose an active account with a verified email address for this diagnostic." };
  const operation = `email-diagnostic:${randomUUID()}`;
  const requested = await prisma.notificationAuditEvent.create({ data: { publicReference: operation, actorUserId, subjectUserId: user.id, eventType: "ADMIN_EMAIL_DIAGNOSTIC_REQUESTED", safeEvidence: { scope: "PROVIDER_DIAGNOSTIC_ONLY" } } });
  let result;
  try {
    result = await providerFactory().send({ destination: user.email, subject: "KT Couriers email connection test", body: "This transactional email connection test was requested by an authorized KT Couriers administrator. It does not confirm an order, payment, identity review or delivery. No action is required.", idempotencyKey: operation });
  } catch {
    result = { accepted: false, safeCode: "EMAIL_DIAGNOSTIC_CONFIGURATION_UNAVAILABLE" };
  }
  const accepted = result.accepted && Boolean(result.providerMessageReference);
  await prisma.notificationAuditEvent.create({ data: { publicReference: `${operation}:result`, actorUserId, subjectUserId: user.id, eventType: accepted ? "ADMIN_EMAIL_DIAGNOSTIC_PROVIDER_ACCEPTED" : "ADMIN_EMAIL_DIAGNOSTIC_FAILED", entityReference: requested.publicReference, safeEvidence: { accepted, providerMessageReference: result.providerMessageReference ?? null, safeCode: result.safeCode ?? null } } });
  return { accepted, delivered: false, logId: requested.publicReference, providerMessageId: result.providerMessageReference, message: accepted ? "The email provider accepted the test message. Inbox delivery is not yet confirmed." : "Provider acceptance could not be confirmed. Check provider configuration and the diagnostic audit.", error: accepted ? undefined : result.safeCode };
}
