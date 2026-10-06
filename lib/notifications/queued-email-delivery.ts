import { prisma } from "@/lib/db/prisma";
import { resolveNotificationProductionComposition } from "./composition-root";
import { deliverSecurityEmail } from "./security-email-delivery";
import { assertNotificationProductionReady } from "./production-readiness";

/** Process due email only, through the canonical atomic claim/provider boundary. */
export async function deliverQueuedEmails(limit: number) {
  assertNotificationProductionReady();
  const candidates = await prisma.notificationDelivery.findMany({
    where: { channel: "EMAIL", status: { in: ["QUEUED", "FAILED_RETRYABLE"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(limit, 200)),
  });
  let completed = 0; let retried = 0; let skipped = 0;
  for (const delivery of candidates) {
    try {
      const block = async (reason: string) => prisma.notificationDelivery.updateMany({ where: { id: delivery.id, status: { in: ["QUEUED", "FAILED_RETRYABLE"] } }, data: { status: "ELIGIBILITY_BLOCKED", eligibilityReason: reason, nextAttemptAt: null } });
      if (delivery.expiresAt && delivery.expiresAt <= new Date()) {
        await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, status: { in: ["QUEUED", "FAILED_RETRYABLE"] } }, data: { status: "EXPIRED", nextAttemptAt: null } });
        skipped++; continue;
      }
      const intent = await prisma.notificationEventIntent.findUnique({ where: { id: delivery.messageId }, select: { sourceAuthority: true } });
      let result;
      if (intent?.sourceAuthority === "AUTHENTICATION_SECURITY") {
        result = await deliverSecurityEmail(delivery.id);
      } else {
        const user = await prisma.user.findUnique({ where: { id: delivery.recipientUserId }, select: { email: true, emailVerifiedAt: true, status: true } });
        if (!user?.email || !user.emailVerifiedAt || user.status !== "ACTIVE") { await block("RECIPIENT_NOT_ELIGIBLE"); skipped++; continue; }
        const message = await prisma.notificationMessage.findUnique({ where: { id: delivery.messageId } });
        if (!message || message.recipientUserId !== delivery.recipientUserId) { await block("MESSAGE_RECIPIENT_MISMATCH"); skipped++; continue; }
        const category = await prisma.notificationCategory.findUnique({ where: { key: message.categoryKey } });
        if (!category || category.status !== "ACTIVE" || category.purpose !== message.purpose) { await block("CATEGORY_NOT_ELIGIBLE"); skipped++; continue; }
        const route = message.routeVersionId ? await prisma.notificationEventRouteVersion.findUnique({ where: { id: message.routeVersionId } }) : null;
        if (message.routeVersionId && route?.status !== "ACTIVE") { await block("ROUTE_NOT_ACTIVE"); skipped++; continue; }
        const composition = resolveNotificationProductionComposition();
        const suppressed = await composition.services.suppressions.isSuppressed({ userId: delivery.recipientUserId, channel: "EMAIL", purpose: message.purpose });
        const eligibility = await composition.services.preferences.evaluate({ userId: delivery.recipientUserId, category, channel: "EMAIL", suppressed, verifiedDestination: true, routeQuietHoursBypass: route?.quietHoursBypass, routeDigestMode: route?.digestMode });
        if (eligibility.state !== "IMMEDIATE") {
          if (eligibility.state === "QUEUED") await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, status: { in: ["QUEUED", "FAILED_RETRYABLE"] } }, data: { nextAttemptAt: new Date(Date.now() + 60_000) } });
          else await block(eligibility.state === "DIGEST" ? "DIGEST_NOT_CONFIGURED" : eligibility.reason ?? "PREFERENCE_NOT_ELIGIBLE");
          skipped++; continue;
        }
        result = await composition.services.delivery.deliver({ deliveryId: delivery.id, destination: user.email, operationId: `production-email:${delivery.publicReference}` });
      }
      if (result?.status === "PROVIDER_ACCEPTED" || result?.status === "DELIVERED") completed++;
      else if (result?.status === "FAILED_RETRYABLE") retried++;
      else skipped++;
    } catch { retried++; }
  }
  return { itemsExamined: candidates.length, itemsClaimed: completed + retried, itemsCompleted: completed, itemsSkipped: skipped, itemsRetried: retried, itemsReconciled: 0, safeSummary: `Email deliveries: ${completed} accepted, ${retried} retryable, ${skipped} skipped.` };
}
