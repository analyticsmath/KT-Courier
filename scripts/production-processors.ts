import { createServer } from "node:http";
import { prisma } from "../lib/db/prisma";
import { executeRegisteredProcessor } from "../lib/processors/processor-service";
import { getProductionProcessorHealthState, getProductionProcessorHealthStatus } from "../lib/processors/production-health";
import { uninitializedMarketplaceOrdersWhere, expiredMarketplaceReservationsWhere } from "../lib/marketplace-checkout/lifecycle-batch.service";
import { dueMarketplaceSettlementJobsWhere } from "../lib/marketplace-checkout/settlement-batch.service";
import {
  createProcessorCadenceTracker,
  createProductionCycleWorkCheck,
  DELEGATED_COMPOSITE_PROCESSORS,
  evaluateCommercialGateState,
  evaluateOperationalWorkerGateState,
  hasEnabledCommercialProcessorWork,
  hasEnabledOrdinaryReferralWork,
  hasEnabledPromotionExpiryWork,
  productionProcessors,
  runProductionCycle,
  summarizeProductionCycleReadiness,
  type ProcessorActivationState,
} from "../lib/processors/production-loop";
import { isActualProductionInstance, promotionsProductionReady } from "../lib/promotions/production-lock";
import { REPORTING_PRODUCTION_VALIDATION_APPROVED } from "../lib/reporting/production-readiness";
import { DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED } from "../lib/developer-api/production-readiness";
import { subscriptionsProductionReady } from "../lib/subscriptions/production-lock";
import { promotersProductionReady } from "../lib/promoters/production-readiness";
import { advertisingProductionReady } from "../lib/advertising/production-lock";
import { PROCESSOR_REGISTRY } from "../lib/processors/processor-registry";
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
let activationGatedProcessors: string[] = [];
let wake: (() => void) | undefined;
const lastSuccessAtByProcessor = new Map<string, string>();
const server = createServer((request, response) => {
  const state = getProductionProcessorHealthState({ stopping, healthy, lastCycleAt });
  const status = getProductionProcessorHealthStatus(request.url ?? "", state);
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify({
    ...state,
    processors: productionProcessors,
    activationGatedProcessors,
    readinessBlockers,
    registryCoverage: {
      totalRegistered: Object.keys(PROCESSOR_REGISTRY).length,
      scheduledInLoop: productionProcessors.length,
      delegatedComposite: DELEGATED_COMPOSITE_PROCESSORS,
    },
    lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null,
  }));
});
if (process.env.KT_PROCESSOR_HTTP_DISABLED !== "true") server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
const shutdown = () => { stopping = true; healthy = false; wake?.(); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function main() {
  let firstCycle = true;
  const cadenceTracker = createProcessorCadenceTracker();

  const initialHeartbeat = await prisma.systemSetting
    .findUnique({ where: { key: "production_processor_heartbeat" }, select: { value: true } })
    .catch(() => null);
  if (initialHeartbeat?.value && typeof initialHeartbeat.value === "object" && "processors" in initialHeartbeat.value) {
    const priorProcessors = (initialHeartbeat.value as { processors?: Array<{ name?: string; lastSuccessAt?: string | null }> }).processors;
    if (Array.isArray(priorProcessors)) {
      for (const entry of priorProcessors) {
        if (entry?.name && typeof entry.lastSuccessAt === "string") {
          lastSuccessAtByProcessor.set(entry.name, entry.lastSuccessAt);
        }
      }
    }
  }

  async function resolveActivationState(name: ProductionProcessor): Promise<{ activationState: ProcessorActivationState; blockerCode: string | null }> {
    const reportingApproved = !(process.env.VERCEL_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_NAME === "production" || isActualProductionInstance()) || REPORTING_PRODUCTION_VALIDATION_APPROVED;
    if (name === "process-ordinary-referral-awards") {
      const authorized = process.env.KT_ORDINARY_REFERRAL_WORKER_AUTHORIZED === "true";
      const setting = await prisma.systemSetting.findUnique({ where: { key: "referral.reward_issuing_enabled" }, select: { type: true, value: true } });
      const settingEnabled = setting?.type === "BOOLEAN" && setting.value === true;
      return evaluateOperationalWorkerGateState({ enabled: authorized && settingEnabled, blockerCode: "ORDINARY_REFERRAL_WORKFLOW" });
    }
    if (name === "end-expired-promotions") {
      return evaluateCommercialGateState({ enabled: process.env.KT_PROMOTION_EXPIRY_WORKER_ENABLED === "true", approved: promotionsProductionReady(), blockerCode: "PROMOTIONS_PRODUCTION_LOCKED" });
    }
    if (name === "expire-report-artifacts") {
      return evaluateCommercialGateState({ enabled: process.env.KT_REPORT_EXPIRY_WORKER_ENABLED === "true", approved: reportingApproved, blockerCode: "REPORTING_PRODUCTION_LOCKED" });
    }
    if (name === "generate-report-jobs") {
      return evaluateCommercialGateState({ enabled: process.env.KT_REPORT_GENERATION_WORKER_ENABLED === "true", approved: reportingApproved, blockerCode: "REPORTING_PRODUCTION_LOCKED" });
    }
    if (name === "expire-developer-api-credentials") {
      return evaluateCommercialGateState({ enabled: process.env.KT_DEVELOPER_CREDENTIAL_EXPIRY_ENABLED === "true", approved: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED, blockerCode: "DEVELOPER_API_PRODUCTION_LOCKED" });
    }
    if (name === "process-subscription-renewals") {
      return evaluateCommercialGateState({ enabled: process.env.KT_SUBSCRIPTION_RENEWAL_WORKER_ENABLED !== "false", approved: subscriptionsProductionReady(), blockerCode: "SUBSCRIPTIONS_PRODUCTION_LOCKED" });
    }
    if (name === "process-promoter-qualifications") {
      return evaluateCommercialGateState({ enabled: process.env.KT_PROMOTER_QUALIFICATION_WORKER_ENABLED !== "false", approved: promotersProductionReady(), blockerCode: "PROMOTERS_PRODUCTION_LOCKED" });
    }
    if (name === "process-valid-click-charges") {
      return evaluateCommercialGateState({ enabled: process.env.KT_ADVERTISING_CLICK_WORKER_ENABLED !== "false", approved: advertisingProductionReady(), blockerCode: "ADVERTISING_PRODUCTION_LOCKED" });
    }
    if (name === "deliver-developer-webhooks") {
      return evaluateCommercialGateState({ enabled: process.env.KT_DEVELOPER_WEBHOOK_WORKER_ENABLED !== "false", approved: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED, blockerCode: "DEVELOPER_API_PRODUCTION_LOCKED" });
    }
    if (name === "reconcile-customer-parcel-loyalty") {
      return evaluateOperationalWorkerGateState({ enabled: process.env.KT_LOYALTY_RECONCILE_WORKER_DISABLED !== "true", blockerCode: "LOYALTY_RECONCILE_WORKFLOW" });
    }
    return { activationState: "ACTIVE", blockerCode: null };
  }

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
      hasPending: async () => {
        if (await prisma.promotionCampaignVersion.findFirst({ where: { status: { in: ["ACTIVE", "PAUSED"] }, endsAt: { lte: new Date() } }, select: { id: true } })) return true;
        const { expirePromotionReservations } = await import("../lib/promotions/promotion-reservation-expiry-batch");
        return (await expirePromotionReservations({ limit: 1, apply: false })).examined > 0;
      },
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
    if (name === "process-managed-marketing-lifecycle") {
      const now = new Date();
      return !!await prisma.managedMarketingRequest.findFirst({
        where: { OR: [{ status: "ENDED" }, { status: { in: ["SCHEDULED", "RUNNING", "PAUSED"] }, endsAt: { lte: now } }] },
        select: { id: true },
      });
    }
    if (name === "process-privacy-requests") {
      const { runConsentWithdrawalBatch } = await import("../lib/privacy/consent-withdrawal-batch");
      return (await runConsentWithdrawalBatch({ mode: "DRY_RUN", batchSize: 1 })).itemsExamined > 0;
    }
    if (name === "process-data-retention") {
      const { runRetentionProcessor } = await import("../lib/retention/retention-processor");
      const preview = await runRetentionProcessor({ mode: "DRY_RUN", batchSize: 1 });
      if (preview.itemsExamined > 0) return true;
      const { phase5Repository } = await import("../lib/operations/phase5-repository");
      const activePolicy = await phase5Repository.retentionPolicyVersion.findFirst({ where: { dataClass: "PRIVATE_MEDIA", status: "ACTIVE" } });
      if (!activePolicy) return false;
      return !!await prisma.privateMediaObject.findFirst({ where: { deletedAt: null, retentionUntil: { lte: new Date() } }, select: { id: true } });
    }
    if (name === "reconcile-customer-parcel-loyalty") {
      if (process.env.KT_LOYALTY_RECONCILE_WORKER_DISABLED === "true") return false;
      const { runCustomerParcelLoyaltyBatch } = await import("../lib/rewards/customer-loyalty-batch");
      return (await runCustomerParcelLoyaltyBatch({ mode: "DRY_RUN", batchSize: 1 })).itemsExamined > 0;
    }
    if (name === "process-subscription-renewals") {
      return hasEnabledCommercialProcessorWork({
        enabled: process.env.KT_SUBSCRIPTION_RENEWAL_WORKER_ENABLED !== "false",
        approved: subscriptionsProductionReady(),
        hasPending: async () => !!await prisma.subscriptionBillingCycle.findFirst({
          where: { status: "SCHEDULED", billingDate: { lte: new Date() }, contract: { status: { in: ["ACTIVE", "GRACE", "PAST_DUE"] } } },
          select: { id: true },
        }),
      });
    }
    if (name === "process-promoter-qualifications") {
      return hasEnabledCommercialProcessorWork({
        enabled: process.env.KT_PROMOTER_QUALIFICATION_WORKER_ENABLED !== "false",
        approved: promotersProductionReady(),
        hasPending: async () => !!await prisma.promoterQualification.findFirst({
          where: { status: "EVIDENCE_OBSERVED" },
          select: { id: true },
        }),
      });
    }
    if (name === "process-valid-click-charges") {
      return hasEnabledCommercialProcessorWork({
        enabled: process.env.KT_ADVERTISING_CLICK_WORKER_ENABLED !== "false",
        approved: advertisingProductionReady(),
        hasPending: async () => {
          const { runAdvertisingClickBatch } = await import("../lib/advertising/click-charge-batch");
          return (await runAdvertisingClickBatch({ limit: 1, apply: false })).examined > 0;
        },
      });
    }
    if (name === "deliver-developer-webhooks") {
      return hasEnabledCommercialProcessorWork({
        enabled: process.env.KT_DEVELOPER_WEBHOOK_WORKER_ENABLED !== "false",
        approved: DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED,
        hasPending: async () => !!await prisma.developerWebhookDelivery.findFirst({
          where: { status: { in: ["PENDING", "FAILED_RETRYABLE", "SENDING"] } },
          select: { id: true },
        }),
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
    const cycleIso = new Date(lastCycleAt).toISOString();
    const cycleReadiness = summarizeProductionCycleReadiness(results, readinessBlockers);
    healthy = cycleReadiness.healthy;
    readinessBlockers = cycleReadiness.readinessBlockers;
    const activationStates = await Promise.all(results.map(async (result) => {
      if (result.status === "COMPLETED") {
        lastSuccessAtByProcessor.set(result.name, cycleIso);
      }
      const gate = await resolveActivationState(result.name).catch(() => ({ activationState: "ACTIVE" as const, blockerCode: null }));
      return {
        name: result.name,
        status: result.status,
        itemsCompleted: result.itemsCompleted,
        itemsRetried: result.itemsRetried,
        activationState: gate.activationState,
        blockerCode: gate.blockerCode,
        lastSuccessAt: lastSuccessAtByProcessor.get(result.name) ?? null,
      };
    }));
    activationGatedProcessors = activationStates
      .filter((entry) => entry.activationState === "ACTIVATION_GATED")
      .map((entry) => entry.name);
    try {
      const value = {
        observedAt: cycleIso,
        healthy,
        readinessBlockers,
        releaseSha: process.env.RENDER_GIT_COMMIT ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
        commercialActivationSummary: activationGatedProcessors.length > 0 ? "PARTIAL_ACTIVATION_GATED" : "ALL_PROGRAMS_ACTIVE",
        activationGatedProcessors,
        registryCoverage: {
          totalRegistered: Object.keys(PROCESSOR_REGISTRY).length,
          scheduledInLoop: productionProcessors.length,
          delegatedComposite: DELEGATED_COMPOSITE_PROCESSORS,
        },
        processors: activationStates,
      };
      await prisma.systemSetting.upsert({ where: { key: "production_processor_heartbeat" }, create: { key: "production_processor_heartbeat", label: "Operations processor heartbeat", type: "JSON", value }, update: { value } });
    } catch { healthy = false; console.error(JSON.stringify({ event: "production_processors.heartbeat_failed", category: "DATABASE_UNAVAILABLE" })); }
    console.log(JSON.stringify({ event: "production_processors.cycle", healthy, readinessBlockers, activationGatedProcessors, results }));
    if (!stopping) await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { wake = undefined; resolve(); }, 30_000);
      wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
    });
  }
}
main().catch(() => { console.error("Production processor loop failed."); process.exitCode = 1; })
  .finally(async () => { healthy = false; if (server.listening) server.close(); await prisma.$disconnect(); });
