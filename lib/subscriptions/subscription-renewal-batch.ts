import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assertSubscriptionsProductionReady } from "./production-lock";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import { createPrismaSubscriptionRenewalLifecycleRepository, prepareSubscriptionRenewalPayment } from "./subscription-renewal-lifecycle.service";

/** Prepares due provider-managed renewals; it never sends a provider charge. */
export async function runSubscriptionRenewalBatch({ limit = 50, now = new Date() }: { limit?: number; now?: Date } = {}) {
  assertSubscriptionsProductionReady("RECURRING_CHARGE");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isFinite(now.getTime())) throw new Error("Invalid subscription renewal batch parameters.");
  const rows = await prisma.subscriptionBillingCycle.findMany({ where: { status: "SCHEDULED", billingDate: { lte: now }, contract: { status: { in: ["ACTIVE", "GRACE", "PAST_DUE"] } } }, select: { id: true, publicReference: true, contractId: true }, orderBy: [{ billingDate: "asc" }, { id: "asc" }], take: limit });
  const repository = createPrismaSubscriptionRenewalLifecycleRepository();
  const result = { examined: rows.length, prepared: 0, skipped: 0, reconciled: 0, failed: 0 };
  for (const row of rows) {
    try {
      const outcome = await withSerializableRetry(() => prepareSubscriptionRenewalPayment(repository, { billingCycleReference: row.publicReference, operationId: `subscription-renewal:${row.id}` }));
      if (outcome.outcome === "PREPARED") result.prepared++;
      else if (outcome.outcome === "RECONCILIATION_REQUIRED") {
        const changed = await prisma.$transaction(async (tx) => {
          const fenced = await tx.subscriptionBillingCycle.updateMany({ where: { id: row.id, status: "SCHEDULED" }, data: { status: "RECONCILIATION_REQUIRED" } });
          if (!fenced.count) return false;
          await tx.subscriptionReconciliationCase.upsert({ where: { caseKey: `subscription-renewal:${row.id}` }, create: { publicReference: `subrec_${randomUUID()}`, caseKey: `subscription-renewal:${row.id}`, contractId: row.contractId, billingCycleId: row.id, reason: "APPLICATION_FAILURE", priority: "HIGH", safeSummary: "Renewal preparation requires provider authority or cycle review.", safeEvidence: { source: "renewal_processor" } }, update: { status: "OPEN", resolvedAt: null, resolutionCode: null, lastObservedAt: now } });
          return true;
        });
        if (changed) result.reconciled++; else result.skipped++;
      } else result.skipped++;
    } catch { result.failed++; }
  }
  return result;
}
