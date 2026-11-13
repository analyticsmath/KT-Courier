import { createServer } from "node:http";
import { prisma } from "../lib/db/prisma";
import { executeRegisteredProcessor } from "../lib/processors/processor-service";
import { getProductionProcessorHealthState, getProductionProcessorHealthStatus } from "../lib/processors/production-health";
import { uninitializedMarketplaceOrdersWhere, expiredMarketplaceReservationsWhere } from "../lib/marketplace-checkout/lifecycle-batch.service";
import { dueMarketplaceSettlementJobsWhere } from "../lib/marketplace-checkout/settlement-batch.service";
import { createProcessorCadenceTracker, createProductionCycleWorkCheck, hasEnabledOrdinaryReferralWork, hasEnabledPromotionExpiryWork, productionProcessors, runProductionCycle, summarizeProductionCycleReadiness } from "../lib/processors/production-loop";
import { isActualProductionInstance, promotionsProductionReady } from "../lib/promotions/production-lock";
import { REPORTING_PRODUCTION_VALIDATION_APPROVED } from "../lib/reporting/production-readiness";
import { DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED } from "../lib/developer-api/production-readiness";
import { checkMarketplaceStoreOrderInitializationReadiness } from "../lib/processors/marketplace-store-order-readiness";
import type { ProductionProcessor } from "../lib/processors/production-loop";
import { createPrismaVerifiedPaymentEventRepository } from "../lib/payments/verified-payment-event-processor.service";
import { listPendingCustomerOrderIntents } from "../lib/notifications/customer-order-publication";
import { emailWorkWhere } from "../lib/notifications/email-delivery-recovery";
import { hasRequiredDomainNotificationWork } from "../lib/notifications/required-domain-intake";

let stopping = false;
let lastCycleAt = 0;
let healthy = false;
let readinessBlockers: string[] = [];
let wake: (() => void) | undefined;
const server = createServer((request, response) => {
  const state = getProductionProcessorHealthState({ stopping, healthy, lastCycleAt });
  const status = getProductionProcessorHealthStatus(request.url ?? "", state);
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify({ ...state, processors: productionProcessors, readinessBlockers, lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null }));
});
if (process.env.KT_PROCESSOR_HTTP_DISABLED !== "true") server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
const shutdown = () => { stopping = true; healthy = false; wake?.(); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function main() {
  let firstCycle = true;
  const cadenceTracker = createProcessorCadenceTracker();
  async function hasWork(name: ProductionProcessor) {
    if (name === "consume-verified-payment-events") return (await createPrismaVerifiedPaymentEventRepository(prisma).listCandidates(1)).length > 0;
    if (name === "apply-paystack-webhook-events") return !!await prisma.paymentWebhookEvent.findFirst({ where: { provider: "PAYSTACK", OR: [{ processingStatus: "RECEIVED" }, { processingStatus: "PROCESSING", leaseExpiresAt: { lt: new Date() } }] }, select: { id: true } });
    if (name === "settle-marketplace-store-orders") return !!await prisma.marketplaceStoreSettlementJob.findFirst({ where: dueMarketplaceSettlementJobsWhere(), select: { id: true } });
    if (name === "initialize-marketplace-store-orders") {
      const now = new Date();
      const readiness = await checkMarketplaceStoreOrderInitializationReadiness({
        hasReconciliationOrder: async () => !!await prisma.marketplaceStoreOrder.findFirst({ where: uninitializedMarketplaceOrdersWhere(true), select: { id: true } }),
        hasPendingOrder: async () => !!await prisma.marketplaceStoreOrder.findFirst({ where: uninitializedMarketplaceOrdersWhere(), select: { id: true } }),
        hasActivePolicy: async () => !!await prisma.storeOrderOperationalPolicy.findFirst({
          where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
          select: { id: true },
        }),
      });
      readinessBlockers = readiness.blocker ? [readiness.blocker] : [];
      return readiness.hasWork;
    }
    if (name === "expire-marketplace-reservations") return !!await prisma.marketplaceInventoryReservation.findFirst({ where: expiredMarketplaceReservationsWhere(), select: { id: true } });
    // A persisted cursor may need one empty pass to wrap and revisit held work.
    if (name === "process-earning-lifecycle") return !!await prisma.order.findFirst({ where: { status: { in: ["DELIVERED", "COMPLETED"] }, assignments: { some: { status: "COMPLETED" } }, driverEarnings: { none: {} } }, select: { id: true } })
      || !!await prisma.storeEarning.findFirst({ where: { status: "ACCRUED", OR: [{ releaseEligibleAt: null }, { releaseEligibleAt: { lte: new Date() } }] }, select: { id: true } })
      || !!await prisma.driverEarning.findFirst({ where: { status: "ACCRUED", OR: [{ releaseEligibleAt: null }, { releaseEligibleAt: { lte: new Date() } }] }, select: { id: true } });
    if (name === "process-ordinary-referral-awards") return hasEnabledOrdinaryReferralWork({
      isAuthorized: process.env.KT_ORDINARY_REFERRAL_WORKER_AUTHORIZED === "true",
      isEnabled: async () => {
        const setting = await prisma.systemSetting.findUnique({ where: { key: "referral.reward_issuing_enabled" }, select: { type: true, value: true } });
        return setting?.type === "BOOLEAN" && setting.value === true;
      },
      hasPending: async () => !!await prisma.referralEvent.findFirst({ where: { source: "ORDINARY_SIGNUP", status: "PENDING", targetUserId: { not: null } }, select: { id: true } }),
    });
    if (name === "end-expired-promotions") return hasEnabledPromotionExpiryWork({
      enabled: process.env.KT_PROMOTION_EXPIRY_WORKER_ENABLED === "true",
      approved: promotionsProductionReady(),
      hasPending: async () => !!await prisma.promotionCampaignVersion.findFirst({ where: { status: { in: ["ACTIVE", "PAUSED"] }, endsAt: { lte: new Date() } }, select: { id: true } }),
    });
    if (name === "expire-report-artifacts") return hasEnabledPromotionExpiryWork({
      enabled: process.env.KT_REPORT_EXPIRY_WORKER_ENABLED === "true",
      approved: !(process.env.VERCEL_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_NAME === "production" || isActualProductionInstance()) || REPORTING_PRODUCTION_VALIDATION_APPROVED,
      hasPending: async () => !!await prisma.reportExportArtifact.findFirst({ where: { storageDeletedAt: null, expiresAt: { lte: new Date() } }, select: { id: true } }),
    });
    if (name === "generate-report-jobs") return hasEnabledPromotionExpiryWork({
      enabled: process.env.KT_REPORT_GENERATION_WORKER_ENABLED === "true",
      approved: !(process.env.VERCEL_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_NAME === "production" || isActualProductionInstance()) || REPORTING_PRODUCTION_VALIDATION_APPROVED,
      hasPending: async () => !!await prisma.reportJob.findFirst({ where: { OR: [{ status: "QUEUED" }, { status: "FAILED_RETRYABLE", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, { status: "RUNNING", claimExpiresAt: { lte: new Date() } }] }, select: { id: true } }),
    });
    if (name === "expire-developer-api-credentials") return hasEnabledPromotionExpiryWork({
      enabled: process.env.KT_DEVELOPER_CREDENTIAL_EXPIRY_ENABLED === "true",
      approved: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED,
      hasPending: async () => !!await prisma.developerApiCredential.findFirst({ where: { status: { in: ["ACTIVE", "EXPIRING"] }, revokedAt: null, expiresAt: { lte: new Date() } }, select: { id: true } }),
    });
    if (name === "reconcile-expired-dispatch") {
      return !!await prisma.orderAssignment.findFirst({
        where: { status: "ASSIGNED", expiresAt: { lte: new Date() } },
        select: { id: true },
      });
    }
    if (name === "dispatch-marketplace-orders") {
      return !!await prisma.marketplaceStoreOrderDeliveryBridge.findFirst({
        where: {
          courierOrderId: { not: null },
          status: { in: ["DISPATCH_PENDING", "DELIVERY_ORDER_CREATED"] },
          storeOrder: {
            acceptanceStatus: "ACCEPTED",
            OR: [
              { derivedStatus: "READY_FOR_PICKUP" },
              { preparationStatus: "READY_FOR_HANDOFF" },
            ],
          },
          courierOrder: {
            status: { in: ["CONFIRMED", "PICKUP_SCHEDULED"] },
            assignments: {
              none: {
                status: { in: ["ASSIGNED", "ACCEPTED"] },
                OR: [
                  { status: "ACCEPTED" },
                  { status: "ASSIGNED", expiresAt: { gt: new Date() } },
                  { status: "ASSIGNED", expiresAt: null },
                ],
              },
            },
          },
        },
        select: { id: true },
      });
    }
    // Finance reconcilers are deliberate periodic checks, even when no
    // existing case is visible. The cadence tracker prevents empty sweeps
    // every 30 seconds; the processors enforce their own batch limits.
    if (name === "scan-payment-reconciliation" ||
        name === "scan-refund-reconciliation" ||
        name === "scan-withdrawal-reconciliation" ||
        name === "scan-paystack-transfer-reconciliation") return true;
    return await hasRequiredDomainNotificationWork(prisma) || (await listPendingCustomerOrderIntents(1)).length > 0 || !!await prisma.notificationDelivery.findFirst({ where: emailWorkWhere(), select: { id: true } });
  }
  while (!stopping) {
    readinessBlockers = [];
    const results = await runProductionCycle(executeRegisteredProcessor, () => stopping, createProductionCycleWorkCheck(hasWork, firstCycle, cadenceTracker));
    firstCycle = false;
    lastCycleAt = Date.now();
    const cycleReadiness = summarizeProductionCycleReadiness(results, readinessBlockers);
    healthy = cycleReadiness.healthy;
    readinessBlockers = cycleReadiness.readinessBlockers;
    try {
      const value = { observedAt: new Date(lastCycleAt).toISOString(), healthy, readinessBlockers, releaseSha: process.env.RENDER_GIT_COMMIT ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? null, processors: results.map((result) => ({ name: result.name, status: result.status, itemsRetried: result.itemsRetried })) };
      await prisma.systemSetting.upsert({ where: { key: "production_processor_heartbeat" }, create: { key: "production_processor_heartbeat", label: "Operations processor heartbeat", type: "JSON", value }, update: { value } });
    } catch { healthy = false; console.error(JSON.stringify({ event: "production_processors.heartbeat_failed", category: "DATABASE_UNAVAILABLE" })); }
    console.log(JSON.stringify({ event: "production_processors.cycle", healthy, readinessBlockers, results }));
    if (!stopping) await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { wake = undefined; resolve(); }, 30_000);
      wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
    });
  }
}
main().catch(() => { console.error("Production processor loop failed."); process.exitCode = 1; })
  .finally(async () => { healthy = false; if (server.listening) server.close(); await prisma.$disconnect(); });
