import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assertDeveloperApiProductionReady } from "./production-readiness";

/** A worker crash can leave the receiver's outcome unknown. Fence it for review. */
export async function recoverStaleWebhookClaims({ limit = 100, now = new Date() }: { limit?: number; now?: Date } = {}) {
  assertDeveloperApiProductionReady();
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid webhook recovery parameters.");
  const staleBefore = new Date(now.getTime() - 5 * 60_000);
  const rows = await prisma.developerWebhookDelivery.findMany({ where: { status: "CLAIMED", lastAttemptedAt: { lte: staleBefore } }, select: { id: true, publicReference: true, attemptCount: true, lastAttemptedAt: true }, orderBy: [{ lastAttemptedAt: "asc" }, { id: "asc" }], take: limit });
  let recovered = 0;
  for (const row of rows) {
    const changed = await prisma.$transaction(async (tx) => {
      const fenced = await tx.developerWebhookDelivery.updateMany({ where: { id: row.id, status: "CLAIMED", attemptCount: row.attemptCount, lastAttemptedAt: { lte: staleBefore } }, data: { status: "FAILED_PERMANENT", nextAttemptAt: null } });
      if (fenced.count !== 1) return false;
      await tx.developerWebhookAttempt.updateMany({ where: { deliveryId: row.id, attemptNumber: row.attemptCount, status: "STARTED" }, data: { status: "FAILED", failureClass: null, completedAt: now, nextAttemptAt: null } });
      await tx.developerApiReconciliationCase.create({ data: { publicReference: `drec_${randomUUID()}`, reason: "WEBHOOK_ATTEMPT_STUCK", status: "OPEN", safeSummary: "Webhook attempt outcome is unknown after worker interruption; review before retry.", safeEvidence: { deliveryReference: row.publicReference, attemptNumber: row.attemptCount } } });
      await tx.developerApiAuditEvent.create({ data: { publicReference: `daudit_${randomUUID()}`, eventType: "WEBHOOK_CLAIM_RECOVERY", entityReference: row.publicReference, safeEvidence: { attemptNumber: row.attemptCount, outcome: "REVIEW_REQUIRED" } } });
      return true;
    });
    if (changed) recovered++;
  }
  return { examined: rows.length, recovered };
}
