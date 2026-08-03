/* eslint-disable @typescript-eslint/no-explicit-any -- generated Phase 22 client validation is deferred. */
/* Canonical TypeScript processor invoked by the bounded .mjs operation shells. */
import { prisma } from "@/lib/db/prisma";
import { resolveAndAssertSubscriptionOperation } from "@/lib/subscriptions/composition-root";
import { createPrismaSubscriptionCancellationRepository, createPrismaSubscriptionProviderSynchronizationRepository } from "@/lib/subscriptions/prisma-subscription-lifecycle.repository";
import { applySubscriptionCancellation } from "@/lib/subscriptions/subscription-cancellation.service";
import { createPrismaSubscriptionRenewalLifecycleRepository, createNextSubscriptionBillingCycle, prepareSubscriptionRenewalPayment } from "@/lib/subscriptions/subscription-renewal-lifecycle.service";
import { recognizeSubscriptionRevenue, createPrismaSubscriptionRevenueRecognitionRepository } from "@/lib/subscriptions/subscription-revenue-recognition.service";
import { synchronizeSubscriptionProviderAuthority } from "@/lib/subscriptions/subscription-provider-synchronization.service";
import { createPrismaSubscriptionDunningRepository, createPrismaSubscriptionExpiryRepository, createPrismaSubscriptionReconciliationScanRepository, expireSubscriptionEntitlements, scanSubscriptionReconciliation } from "@/lib/subscriptions/subscription-operational-processor.service";
import { processSubscriptionDunning } from "@/lib/subscriptions/subscription-dunning.service";

type ProcessorName = "create-subscription-renewal-cycles" | "process-subscription-renewals" | "process-subscription-dunning" | "process-subscription-cancellations" | "synchronize-subscription-providers" | "expire-subscription-entitlements" | "scan-subscription-reconciliation" | "recognize-subscription-revenue";
const db = prisma as any;
const [name, mode, limitFlag, rawLimit] = process.argv.slice(2);
const limit = limitFlag === "--limit" ? Number(rawLimit) : 50;

async function candidates(processor: ProcessorName) {
  switch (processor) {
    case "create-subscription-renewal-cycles": return db.subscriptionContract.findMany({ where: { status: { in: ["ACTIVE", "GRACE", "PAST_DUE"] } }, select: { publicReference: true }, take: limit, orderBy: { updatedAt: "asc" } });
    case "process-subscription-renewals": return db.subscriptionBillingCycle.findMany({ where: { status: "SCHEDULED" }, select: { publicReference: true }, take: limit, orderBy: { billingDate: "asc" } });
    case "process-subscription-cancellations": return db.subscriptionContract.findMany({ where: { status: "CANCELLATION_SCHEDULED", cancellationEffectiveAt: { lte: new Date() } }, select: { publicReference: true }, take: limit, orderBy: { cancellationEffectiveAt: "asc" } });
    case "synchronize-subscription-providers": return db.subscriptionPaymentAuthority.findMany({ where: { status: { in: ["PENDING", "ACTIVE", "CANCELLED"] } }, select: { publicReference: true }, take: limit, orderBy: { updatedAt: "asc" } });
    case "recognize-subscription-revenue": return db.subscriptionRevenueRecognitionSchedule.findMany({ where: { status: "ACTIVE" }, select: { publicReference: true }, take: limit, orderBy: { serviceEnd: "asc" } });
    case "expire-subscription-entitlements": return db.subscriptionEntitlementGrant.findMany({ where: { status: "ACTIVE", effectiveUntil: { lte: new Date() } }, select: { publicReference: true }, take: limit, orderBy: { effectiveUntil: "asc" } });
    case "process-subscription-dunning": return db.subscriptionRenewalJob.findMany({ where: { status: "RETRYABLE" }, select: { publicReference: true }, take: limit, orderBy: { nextAttemptAt: "asc" } });
    case "scan-subscription-reconciliation": return db.subscriptionReconciliationCase.findMany({ where: { status: "OPEN" }, select: { publicReference: true }, take: limit, orderBy: { lastObservedAt: "asc" } });
  }
}

async function apply(processor: ProcessorName, rows: readonly any[]) {
  const composition = resolveAndAssertSubscriptionOperation("ADMIN_RECOVERY");
  const renewal = createPrismaSubscriptionRenewalLifecycleRepository();
  for (const [index, row] of rows.entries()) {
    const operationId = `subscription-processor:${processor}:${row.publicReference}:${index}`;
    switch (processor) {
      case "create-subscription-renewal-cycles": await createNextSubscriptionBillingCycle(renewal, { contractReference: row.publicReference, operationId }); break;
      case "process-subscription-renewals": await prepareSubscriptionRenewalPayment(renewal, { billingCycleReference: row.publicReference, operationId }); break;
      case "process-subscription-cancellations": await applySubscriptionCancellation(createPrismaSubscriptionCancellationRepository(), { contractReference: row.publicReference, operationId }); break;
      case "synchronize-subscription-providers": await synchronizeSubscriptionProviderAuthority(createPrismaSubscriptionProviderSynchronizationRepository(), composition.recurringProvider as any, { authorityReference: row.publicReference, operationId }); break;
      case "recognize-subscription-revenue": await recognizeSubscriptionRevenue(createPrismaSubscriptionRevenueRecognitionRepository(), { scheduleReference: row.publicReference, through: new Date(), operationId }); break;
      case "expire-subscription-entitlements": await expireSubscriptionEntitlements(createPrismaSubscriptionExpiryRepository(), { grantReference: row.publicReference, operationId }); break;
      case "process-subscription-dunning": await processSubscriptionDunning(createPrismaSubscriptionDunningRepository(), { operationId, providerOutcome: "FAILED" }); break;
      case "scan-subscription-reconciliation": await scanSubscriptionReconciliation(createPrismaSubscriptionReconciliationScanRepository(), { caseReference: row.publicReference, operationId }); break;
    }
  }
}

if (!Object.keys({ "create-subscription-renewal-cycles": true, "process-subscription-renewals": true, "process-subscription-dunning": true, "process-subscription-cancellations": true, "synchronize-subscription-providers": true, "expire-subscription-entitlements": true, "scan-subscription-reconciliation": true, "recognize-subscription-revenue": true }).includes(name) || mode !== "--apply" || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("Invalid canonical subscription processor invocation.");
const rows = await candidates(name as ProcessorName);
await apply(name as ProcessorName, rows);
console.log(`${name}: applied ${rows.length} bounded canonical operations.`);
