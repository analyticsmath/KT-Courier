import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import { AdvertisingBillingService } from "./billing.service";
import { assertAdvertisingProductionReady } from "./production-lock";

/** Only events with explicit billable classification may enter automated charging. */
export async function runAdvertisingClickBatch({ limit = 50, apply = false }: { limit?: number; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Invalid advertising click batch size.");
  if (apply) assertAdvertisingProductionReady("CLICK_CHARGING");
  const events = await prisma.advertisingMeasurementEvent.findMany({ where: { eventType: "CLICK", validityStatus: "VALID", safeEvidence: { path: ["classification"], equals: "VALID_BILLABLE" }, clickCharges: { none: {} }, reconciliationCases: { none: { reason: "VALID_CLICK_WITHOUT_CHARGE", status: { in: ["OPEN", "MONITORING"] } } } }, select: { id: true, publicReference: true, campaignVersionId: true, sessionFingerprint: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
  const result = { examined: events.length, charged: 0, reconciled: 0, failed: 0 };
  if (!apply) return result;
  const billing = new AdvertisingBillingService();
  for (const event of events) {
    const operationId = `ad-click:${event.id}`;
    const requestHash = createHash("sha256").update(`ad-click:${event.id}`).digest("hex");
    try {
      const charge = await withSerializableRetry(() => billing.chargeClick({ measurementEventId: event.id, sessionFingerprint: event.sessionFingerprint ?? "", operationId, requestHash }));
      if (charge.status !== "CHARGED") throw new Error("Click charge did not reach a charged state.");
      result.charged++;
    } catch {
      try {
        const outcome = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "AdvertisingMeasurementEvent" WHERE id = ${event.id} FOR UPDATE`;
          await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`ad-click-reconciliation:${event.id}`}))::text`);
          const existing = await tx.advertisingReconciliationCase.findFirst({ where: { measurementEventId: event.id, reason: "VALID_CLICK_WITHOUT_CHARGE", status: { in: ["OPEN", "MONITORING"] } } });
          const charged = await tx.advertisingClickCharge.findFirst({ where: { measurementEventId: event.id } });
          if (charged) return "charged" as const;
          if (!existing) await tx.advertisingReconciliationCase.create({ data: { publicReference: `AD-REC-${randomUUID()}`, campaignVersionId: event.campaignVersionId, measurementEventId: event.id, reason: "VALID_CLICK_WITHOUT_CHARGE", status: "OPEN", priority: "HIGH", safeSummary: "Billable click could not be charged and requires review.", safeEvidence: { source: "advertising_click_batch" } } });
          return "reconciled" as const;
        }, { isolationLevel: "ReadCommitted" });
        if (outcome === "charged") result.charged++; else result.reconciled++;
      } catch { result.failed++; }
    }
  }
  return result;
}
