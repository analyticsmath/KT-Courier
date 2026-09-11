import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { acquireProcessorLease, completeProcessorRun, listProcessorRuns } from "./lease-authority";
import {
  PROCESSOR_REGISTRY,
  getRegisteredProcessor,
  type RegisteredProcessor,
  type ProcessorName,
  type ImplementedProcessorName,
} from "./processor-registry";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { safeOperationalText } from "@/lib/operations/phase5-repository";

export interface ExecuteProcessorOptions {
  name: ProcessorName | string;
  partition?: string;
  mode?: "DRY_RUN" | "APPLY";
  batchSize?: number;
  actorUserId?: string;
  operationId?: string;
}

export interface ProcessorExecutionResult {
  success: boolean;
  name: string;
  version: string;
  mode: "DRY_RUN" | "APPLY";
  operationId: string;
  status: string;
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  failureCount: number;
  safeSummary: string;
  executedAt: string;
}

export interface ProcessorHandlerContext {
  mode: "DRY_RUN" | "APPLY";
  batchSize: number;
  operationId: string;
  actorUserId?: string;
  partition?: string;
}

export interface ProcessorHandlerOutcome {
  itemsExamined: number;
  itemsClaimed: number;
  itemsCompleted: number;
  itemsSkipped: number;
  itemsRetried: number;
  itemsReconciled: number;
  safeSummary: string;
}

export type ProcessorHandler = (context: ProcessorHandlerContext) => Promise<ProcessorHandlerOutcome>;

export const PROCESSOR_HANDLERS: Record<ImplementedProcessorName, ProcessorHandler> = {
  "consume-verified-payment-events": async ({ mode, batchSize }) => {
    if (mode === "DRY_RUN") {
      const { createPrismaVerifiedPaymentEventRepository } = await import(
        "@/lib/payments/verified-payment-event-processor.service"
      );
      const candidates = await createPrismaVerifiedPaymentEventRepository(prisma).listCandidates(batchSize);
      return {
        itemsExamined: candidates.length,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: candidates.length,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Evaluated ${candidates.length} verified payment event intents; 0 mutated.`,
      };
    }
    const { consumeVerifiedPaymentEvents } = await import("@/lib/payments/verified-payment-event-processor.service");
    const outcomes = await consumeVerifiedPaymentEvents({ limit: batchSize });
    const itemsExamined = Object.values(outcomes).reduce((sum, n) => sum + n, 0);
    const itemsCompleted =
      outcomes.MARKETPLACE_FINALIZED +
      outcomes.SUBSCRIPTION_ACTIVATED +
      outcomes.MANAGED_MARKETING_RECOGNIZED +
      outcomes.NO_DOWNSTREAM_EFFECT;
    const itemsSkipped = outcomes.SKIPPED;
    const itemsReconciled = outcomes.RECONCILIATION_REQUIRED;
    const itemsClaimed = itemsCompleted + itemsReconciled;
    return {
      itemsExamined,
      itemsClaimed,
      itemsCompleted,
      itemsSkipped,
      itemsRetried: 0,
      itemsReconciled,
      safeSummary: `Payment events processed: ${itemsCompleted} finalized, ${itemsReconciled} reconciliation needed, ${itemsSkipped} skipped.`,
    };
  },

  "apply-paystack-webhook-events": async ({ mode, batchSize }) => {
    if (mode === "DRY_RUN") {
      const candidates = await prisma.paymentWebhookEvent.findMany({
        where: {
          provider: "PAYSTACK",
          OR: [
            { processingStatus: "RECEIVED" },
            {
              processingStatus: "PROCESSING",
              leaseExpiresAt: { not: null, lt: new Date() },
            },
          ],
        },
        take: batchSize,
        select: { id: true },
      });
      return {
        itemsExamined: candidates.length,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: candidates.length,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Evaluated ${candidates.length} pending Paystack webhook inbox events; 0 claimed or mutated.`,
      };
    }
    const { applyPaystackWebhookEventsBatch } = await import(
      "@/lib/services/paystack-webhook-application.service"
    );
    const result = await applyPaystackWebhookEventsBatch({ batchSize });
    return {
      itemsExamined: result.itemsExamined,
      itemsClaimed: result.itemsClaimed,
      itemsCompleted: result.itemsCompleted,
      itemsSkipped: result.itemsSkipped,
      itemsRetried: result.itemsRetried,
      itemsReconciled: result.itemsReconciled,
      safeSummary: result.safeSummary,
    };
  },

  "scan-paystack-transfer-reconciliation": async ({ mode, batchSize }) => {
    if (mode === "DRY_RUN") {
      const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);
      const candidates = await prisma.withdrawalPayoutAttempt.findMany({
        where: {
          status: { in: ["PROCESSING", "UNKNOWN"] },
          externalReference: { not: null, startsWith: "kt_wpa_" },
          OR: [
            { lastPolledAt: null, createdAt: { lte: staleCutoff } },
            { lastPolledAt: { lte: staleCutoff } },
          ],
        },
        take: batchSize,
        select: { id: true },
      });
      return {
        itemsExamined: candidates.length,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: candidates.length,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Evaluated ${candidates.length} stale Paystack payout attempts; 0 queried or mutated.`,
      };
    }
    const { scanPaystackTransferReconciliation } = await import(
      "@/lib/services/paystack-transfer-reconciliation.service"
    );
    const result = await scanPaystackTransferReconciliation({ limit: batchSize });
    return {
      itemsExamined: result.itemsExamined,
      itemsClaimed: result.itemsExamined,
      itemsCompleted: result.itemsSucceeded + result.itemsFailed + result.itemsReversed,
      itemsSkipped: result.itemsPending,
      itemsRetried: result.itemsErrored,
      itemsReconciled: result.itemsReversed,
      safeSummary: result.safeSummary,
    };
  },

  "finalize-paid-marketplace-checkouts": async ({ mode, batchSize }) => {
    if (mode === "DRY_RUN") {
      const { createPrismaVerifiedPaymentEventRepository } = await import(
        "@/lib/payments/verified-payment-event-processor.service"
      );
      const candidates = await createPrismaVerifiedPaymentEventRepository(prisma).listCandidates(batchSize, [
        "MARKETPLACE_CHECKOUT",
      ]);
      return {
        itemsExamined: candidates.length,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: candidates.length,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Evaluated ${candidates.length} paid checkout intents; 0 mutated.`,
      };
    }
    const { consumeVerifiedPaymentEvents } = await import("@/lib/payments/verified-payment-event-processor.service");
    const outcomes = await consumeVerifiedPaymentEvents({ limit: batchSize, subjectTypes: ["MARKETPLACE_CHECKOUT"] });
    const itemsExamined = Object.values(outcomes).reduce((sum, n) => sum + n, 0);
    const itemsCompleted = outcomes.MARKETPLACE_FINALIZED;
    const itemsSkipped = outcomes.SKIPPED;
    const itemsReconciled = outcomes.RECONCILIATION_REQUIRED;
    const itemsClaimed = itemsCompleted + itemsReconciled;
    return {
      itemsExamined,
      itemsClaimed,
      itemsCompleted,
      itemsSkipped,
      itemsRetried: 0,
      itemsReconciled,
      safeSummary: `Marketplace checkout finalization: ${itemsCompleted} finalized, ${itemsReconciled} reconciliation needed, ${itemsSkipped} skipped.`,
    };
  },

  "release-mature-store-earnings": async ({ mode, batchSize }) => {
    const mature = await prisma.storeEarning.findMany({
      where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() }, refundReservedAmount: 0 },
      select: { id: true },
      orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }],
      take: batchSize,
    });
    const itemsExamined = mature.length;
    let itemsCompleted = 0;
    let itemsRetried = 0;
    if (mode === "APPLY") {
      const { releaseStoreEarning } = await import("@/lib/services/store-earning-release.service");
      for (const earning of mature) {
        try {
          await releaseStoreEarning({ earningId: earning.id, operationId: `mature-store-release:${randomUUID()}` });
          itemsCompleted += 1;
        } catch {
          itemsRetried += 1;
        }
      }
    }
    return {
      itemsExamined,
      itemsClaimed: itemsCompleted,
      itemsCompleted,
      itemsSkipped: mode === "DRY_RUN" ? itemsExamined : itemsExamined - itemsCompleted - itemsRetried,
      itemsRetried,
      itemsReconciled: 0,
      safeSummary:
        mode === "DRY_RUN"
          ? `[DRY_RUN] Evaluated ${itemsExamined} mature store earnings; 0 released.`
          : `Evaluated ${itemsExamined} mature store earnings; released ${itemsCompleted}.`,
    };
  },

  "release-mature-driver-earnings": async ({ mode, batchSize }) => {
    const mature = await prisma.driverEarning.findMany({
      where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() } },
      select: { id: true },
      orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }],
      take: batchSize,
    });
    const itemsExamined = mature.length;
    let itemsCompleted = 0;
    let itemsRetried = 0;
    if (mode === "APPLY") {
      const { releaseDriverEarning } = await import("@/lib/services/driver-earning-release.service");
      for (const earning of mature) {
        try {
          await releaseDriverEarning({ earningId: earning.id, operationId: `mature-driver-release:${randomUUID()}` });
          itemsCompleted += 1;
        } catch {
          itemsRetried += 1;
        }
      }
    }
    return {
      itemsExamined,
      itemsClaimed: itemsCompleted,
      itemsCompleted,
      itemsSkipped: mode === "DRY_RUN" ? itemsExamined : itemsExamined - itemsCompleted - itemsRetried,
      itemsRetried,
      itemsReconciled: 0,
      safeSummary:
        mode === "DRY_RUN"
          ? `[DRY_RUN] Evaluated ${itemsExamined} mature driver earnings; 0 released.`
          : `Evaluated ${itemsExamined} mature driver earnings; released ${itemsCompleted}.`,
    };
  },

  "process-managed-marketing-lifecycle": async ({ mode, batchSize, operationId }) => {
    const { ManagedMarketingService } = await import("@/lib/advertising/managed-marketing.service");
    const lifecycleResult = await new ManagedMarketingService().runLifecycleProcessor({
      mode,
      batchSize,
      processorOperationId: operationId,
    });
    return {
      itemsExamined: lifecycleResult.itemsExamined,
      itemsClaimed: lifecycleResult.itemsClaimed,
      itemsCompleted: lifecycleResult.itemsCompleted,
      itemsSkipped: lifecycleResult.itemsSkipped,
      itemsRetried: 0,
      itemsReconciled: lifecycleResult.itemsReconciled,
      safeSummary: lifecycleResult.safeSummary,
    };
  },

  "process-data-retention": async ({ mode, batchSize, actorUserId }) => {
    const { runRetentionProcessor } = await import("@/lib/retention/retention-processor");
    const retentionResult = await runRetentionProcessor({
      mode,
      batchSize,
      actorUserId,
    });
    return {
      itemsExamined: retentionResult.itemsExamined,
      itemsClaimed: retentionResult.itemsClaimed,
      itemsCompleted: retentionResult.itemsCompleted,
      itemsSkipped: retentionResult.itemsSkipped,
      itemsRetried: 0,
      itemsReconciled: retentionResult.itemsReconciled,
      safeSummary: retentionResult.safeSummary,
    };
  },

  "scan-refund-reconciliation": async ({ mode }) => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 15 * 60_000);
    const staleProcessing = await prisma.refundExecutionAttempt.findMany({
      where: { status: "PROCESSING", updatedAt: { lte: staleBefore } },
      select: { id: true, publicReference: true, refund: { select: { id: true, publicReference: true } } },
    });
    const payments = await prisma.payment.findMany({
      where: { OR: [{ totalRefundedAmount: { gt: 0 } }, { totalRefundReservedAmount: { gt: 0 } }] },
      select: { id: true },
    });
    const itemsExamined = staleProcessing.length + payments.length;
    if (mode === "DRY_RUN") {
      return {
        itemsExamined,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: itemsExamined,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Scanned ${itemsExamined} refund reconciliation candidates; 0 cases opened.`,
      };
    }
    const { scanRefundReconciliation } = await import("@/lib/services/refund-reconciliation.service");
    await scanRefundReconciliation({ now, staleAfterMs: 15 * 60_000 });
    return {
      itemsExamined,
      itemsClaimed: staleProcessing.length,
      itemsCompleted: staleProcessing.length,
      itemsSkipped: 0,
      itemsRetried: 0,
      itemsReconciled: staleProcessing.length,
      safeSummary: `Refund reconciliation scan executed across ${itemsExamined} records; processed ${staleProcessing.length} stale attempts.`,
    };
  },

  "scan-withdrawal-reconciliation": async ({ mode }) => {
    const threshold = new Date(Date.now() - 30 * 60_000);
    const stale = await prisma.withdrawalPayoutAttempt.findMany({
      where: { status: { in: ["PROCESSING", "UNKNOWN"] }, updatedAt: { lt: threshold } },
      include: { withdrawal: { select: { id: true, publicReference: true, status: true } } },
    });
    const itemsExamined = stale.length;
    if (mode === "DRY_RUN") {
      return {
        itemsExamined,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: itemsExamined,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Scanned ${itemsExamined} stale withdrawal payout attempts; 0 cases opened.`,
      };
    }
    let casesOpened = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const attempt of stale) {
          const reason = attempt.status === "UNKNOWN" ? "UNKNOWN_PAYOUT_OUTCOME" : "STALE_PROCESSING_ATTEMPT";
          const summary = `Withdrawal payout attempt remains ${attempt.status.toLowerCase()} beyond the reconciliation threshold.`;
          const caseKey = `withdrawal:${attempt.withdrawal.publicReference}:${reason}:${attempt.publicReference}`;
          await tx.withdrawalReconciliationCase.upsert({
            where: { caseKey },
            create: {
              publicReference: `WRC-${randomUUID().replaceAll("-", "").toUpperCase()}`,
              caseKey,
              withdrawalId: attempt.withdrawal.id,
              payoutAttemptId: attempt.id,
              reason,
              priority: "HIGH",
              safeSummary: summary,
            },
            update: {
              lastObservedAt: new Date(),
              observationCount: { increment: 1 },
            },
          });
          casesOpened += 1;
        }
      },
      { isolationLevel: "Serializable" },
    );
    return {
      itemsExamined,
      itemsClaimed: casesOpened,
      itemsCompleted: casesOpened,
      itemsSkipped: 0,
      itemsRetried: 0,
      itemsReconciled: casesOpened,
      safeSummary: `Withdrawal reconciliation scan observed ${casesOpened} stale payout attempt candidates.`,
    };
  },

  "scan-payment-reconciliation": async ({ mode }) => {
    const threshold = new Date(Date.now() - 30 * 60_000);
    const staleAttempts = await prisma.paymentAttempt.findMany({
      where: {
        updatedAt: { lt: threshold },
        OR: [
          { status: "UNKNOWN" },
          { status: "PROCESSING", webhookEvents: { none: { providerDataVerified: true } } },
          { status: "REQUIRES_ACTION", expiresAt: { lt: new Date() } },
        ],
      },
      select: { id: true, paymentId: true, status: true, publicReference: true, provider: true },
    });
    const itemsExamined = staleAttempts.length;
    if (mode === "DRY_RUN") {
      return {
        itemsExamined,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: itemsExamined,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Scanned ${itemsExamined} payment reconciliation candidates; 0 cases opened.`,
      };
    }
    const { openPaymentReconciliationCaseWithinTransaction } = await import(
      "@/lib/services/payment-reconciliation.service"
    );
    let casesOpened = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const attempt of staleAttempts) {
          await openPaymentReconciliationCaseWithinTransaction(tx, {
            paymentId: attempt.paymentId,
            attemptId: attempt.id,
            reason: "STALE_PROCESSING_ATTEMPT",
            provider: (attempt.provider ?? "PAYSTACK") as "PAYFAST" | "PAYSTACK",
            safeEvidence: { attemptReference: attempt.publicReference, observedStatus: attempt.status },
          });
          casesOpened += 1;
        }
      },
      { isolationLevel: "Serializable" },
    );
    return {
      itemsExamined,
      itemsClaimed: casesOpened,
      itemsCompleted: casesOpened,
      itemsSkipped: 0,
      itemsRetried: 0,
      itemsReconciled: casesOpened,
      safeSummary: `Payment reconciliation scan recorded ${casesOpened} anomalies.`,
    };
  },

  "deliver-notifications": async ({ mode }) => {
    const queuedCount = await prisma.notificationDelivery.count({ where: { status: "QUEUED" } });
    if (mode === "DRY_RUN") {
      return {
        itemsExamined: queuedCount,
        itemsClaimed: 0,
        itemsCompleted: 0,
        itemsSkipped: queuedCount,
        itemsRetried: 0,
        itemsReconciled: 0,
        safeSummary: `[DRY_RUN] Evaluated ${queuedCount} queued notification deliveries; 0 dispatched.`,
      };
    }
    const { assertNotificationProductionReady } = await import("@/lib/notifications/production-readiness");
    assertNotificationProductionReady();
    return {
      itemsExamined: queuedCount,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: queuedCount,
      itemsRetried: 0,
      itemsReconciled: 0,
      safeSummary: `Delivered 0 notifications.`,
    };
  },
};

export async function getProcessorInventory(): Promise<
  Array<RegisteredProcessor & { lastRun?: Record<string, unknown> | null }>
> {
  const processors = Object.values(PROCESSOR_REGISTRY) as RegisteredProcessor[];
  const runs = await listProcessorRuns(undefined, 100).catch(() => []);

  return processors.map((p) => {
    const lastRun = runs.find((r) => String(r.jobName) === p.name) ?? null;
    return {
      ...p,
      lastRun: lastRun ? (lastRun as Record<string, unknown>) : null,
    };
  });
}

export async function executeRegisteredProcessor(
  options: ExecuteProcessorOptions,
): Promise<ProcessorExecutionResult> {
  const processor = getRegisteredProcessor(options.name);
  if (!processor) {
    throw new Error(`Unregistered processor '${options.name}' cannot be invoked.`);
  }

  const mode = options.mode ?? "DRY_RUN";
  if (mode === "DRY_RUN" && !processor.dryRunSupported) {
    throw new Error(`Processor '${options.name}' does not support dry-run mode.`);
  }

  if (processor.status === "DISABLED") {
    throw new Error(
      `PROCESSOR_HANDLER_NOT_IMPLEMENTED: Processor '${processor.name}' is currently disabled and has no active executable handler.`,
    );
  }

  const handler = PROCESSOR_HANDLERS[processor.name as ImplementedProcessorName];
  if (!handler) {
    throw new Error(
      `PROCESSOR_HANDLER_NOT_IMPLEMENTED: Processor '${processor.name}' does not have a registered domain handler.`,
    );
  }

  const leaseOwner = options.actorUserId ? `admin:${options.actorUserId}` : `cron:${processor.name}`;
  const batchSize = Math.min(options.batchSize ?? processor.defaultBatchSize, processor.maxBatchSize);

  let leaseResult;
  if (processor.leaseRequired) {
    leaseResult = await acquireProcessorLease({
      jobName: processor.name,
      partition: options.partition ?? processor.defaultPartition,
      leaseOwner,
      operationId: options.operationId,
      mode,
    });

    if (!leaseResult.acquired) {
      throw new Error(`Cannot execute processor '${processor.name}': ${leaseResult.reason}`);
    }
  }

  const operationId = leaseResult?.operationId ?? options.operationId ?? `OP-${Date.now()}`;
  const executedAt = new Date().toISOString();

  let failureCount = 0;

  try {
    const outcome = await handler({
      mode,
      batchSize,
      operationId,
      actorUserId: options.actorUserId,
      partition: options.partition,
    });

    const terminalStatus = mode === "DRY_RUN" ? "DRY_RUN_COMPLETED" : "APPLY_COMPLETED";

    if (processor.leaseRequired) {
      await completeProcessorRun({
        operationId,
        leaseOwner,
        status: terminalStatus,
        itemsClaimed: outcome.itemsClaimed,
        itemsCompleted: outcome.itemsCompleted,
        itemsRetried: outcome.itemsRetried,
        itemsReconciled: outcome.itemsReconciled,
        safeSummary: outcome.safeSummary,
      });
    }

    if (options.actorUserId) {
      await recordAdminActivity({
        actorUserId: options.actorUserId,
        action: "STATUS_CHANGE",
        entityType: "OperationalProcessor",
        entityId: processor.name,
        message: `Executed processor '${processor.name}' in ${mode} mode`,
        metadata: {
          operationId,
          mode,
          batchSize,
          itemsCompleted: outcome.itemsCompleted,
        },
      });
    }

    return {
      success: true,
      name: processor.name,
      version: processor.version,
      mode,
      operationId,
      status: terminalStatus,
      itemsExamined: outcome.itemsExamined,
      itemsClaimed: outcome.itemsClaimed,
      itemsCompleted: outcome.itemsCompleted,
      itemsSkipped: outcome.itemsSkipped,
      itemsRetried: outcome.itemsRetried,
      itemsReconciled: outcome.itemsReconciled,
      failureCount,
      safeSummary: outcome.safeSummary,
      executedAt,
    };
  } catch (err) {
    failureCount++;
    const safeErrorCategory = err instanceof Error ? err.name : "EXECUTION_FAILURE";
    const errSummary = safeOperationalText(err instanceof Error ? err.message : "Processor execution failed");

    if (processor.leaseRequired) {
      await completeProcessorRun({
        operationId,
        leaseOwner,
        status: "FAILED",
        safeErrorCategory,
        safeSummary: errSummary,
      }).catch(() => null);
    }

    throw err;
  }
}

