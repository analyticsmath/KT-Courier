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
      const intent = await prisma.notificationEventIntent.findUnique({ where: { id: delivery.messageId }, select: { sourceAuthority: true } });
      let result;
      if (intent?.sourceAuthority === "AUTHENTICATION_SECURITY") {
        result = await deliverSecurityEmail(delivery.id);
      } else {
        const user = await prisma.user.findUnique({ where: { id: delivery.recipientUserId }, select: { email: true, emailVerifiedAt: true, status: true } });
        if (!user?.email || !user.emailVerifiedAt || user.status !== "ACTIVE") { skipped++; continue; }
        const composition = resolveNotificationProductionComposition();
        result = await composition.services.delivery.deliver({ deliveryId: delivery.id, destination: user.email, operationId: `production-email:${delivery.publicReference}` });
      }
      if (result?.status === "PROVIDER_ACCEPTED" || result?.status === "DELIVERED") completed++;
      else if (result?.status === "FAILED_RETRYABLE") retried++;
      else skipped++;
    } catch { retried++; }
  }
  return { itemsExamined: candidates.length, itemsClaimed: completed + retried, itemsCompleted: completed, itemsSkipped: skipped, itemsRetried: retried, itemsReconciled: 0, safeSummary: `Email deliveries: ${completed} accepted, ${retried} retryable, ${skipped} skipped.` };
}
