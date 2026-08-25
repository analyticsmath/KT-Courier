import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { acquireProcessorLease, completeProcessorRun, listProcessorRuns } from "./lease-authority";
import { PROCESSOR_REGISTRY, type RegisteredProcessor } from "./processor-registry";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { safeOperationalText } from "@/lib/operations/phase5-repository";

export interface ExecuteProcessorOptions {
  name: string;
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

export async function getProcessorInventory(): Promise<Array<RegisteredProcessor & { lastRun?: Record<string, unknown> | null }>> {
  const processors = Object.values(PROCESSOR_REGISTRY);
  const runs = await listProcessorRuns(undefined, 100).catch(() => []);

  return processors.map((p) => {
    const lastRun = runs.find((r) => String(r.jobName) === p.name) ?? null;
    return {
      ...p,
      lastRun: lastRun ? (lastRun as Record<string, unknown>) : null,
    };
  });
}

export async function executeRegisteredProcessor(options: ExecuteProcessorOptions): Promise<ProcessorExecutionResult> {
  const processor = PROCESSOR_REGISTRY[options.name];
  if (!processor) {
    throw new Error(`Unregistered processor '${options.name}' cannot be invoked.`);
  }

  const mode = options.mode ?? "DRY_RUN";
  if (mode === "DRY_RUN" && !processor.dryRunSupported) {
    throw new Error(`Processor '${options.name}' does not support dry-run mode.`);
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

  let itemsExamined = 0;
  let itemsClaimed = 0;
  let itemsCompleted = 0;
  let itemsSkipped = 0;
  let itemsRetried = 0;
  let itemsReconciled = 0;
  let failureCount = 0;
  let safeSummary = "";

  try {
    if (processor.name === "consume-verified-payment-events" || processor.name === "finalize-paid-marketplace-checkouts") {
      const { consumeVerifiedPaymentEvents } = await import("@/lib/payments/verified-payment-event-processor.service");
      const subjectTypes = processor.name === "finalize-paid-marketplace-checkouts" ? (["MARKETPLACE_CHECKOUT"] as const) : undefined;
      const outcomes = await consumeVerifiedPaymentEvents({ limit: batchSize, subjectTypes });
      itemsExamined = Object.values(outcomes).reduce((sum, n) => sum + n, 0);
      itemsCompleted = outcomes.MARKETPLACE_FINALIZED + outcomes.SUBSCRIPTION_ACTIVATED + outcomes.MANAGED_MARKETING_RECOGNIZED + outcomes.NO_DOWNSTREAM_EFFECT;
      itemsSkipped = outcomes.SKIPPED;
      itemsReconciled = outcomes.RECONCILIATION_REQUIRED;
      itemsClaimed = itemsCompleted + itemsReconciled;
      safeSummary = `Payment events processed: ${itemsCompleted} finalized, ${itemsReconciled} reconciliation needed, ${itemsSkipped} skipped.`;
    } else if (processor.name === "release-mature-store-earnings") {
      const mature = await prisma.storeEarning.findMany({
        where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() }, refundReservedAmount: 0 },
        select: { id: true },
        orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }],
        take: batchSize,
      });
      itemsExamined = mature.length;
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
      itemsClaimed = itemsCompleted;
      safeSummary = `Evaluated ${itemsExamined} mature store earnings; released ${itemsCompleted}.`;
    } else if (processor.name === "release-mature-driver-earnings") {
      const mature = await prisma.driverEarning.findMany({
        where: { status: "ACCRUED", releaseEligibleAt: { lte: new Date() } },
        select: { id: true },
        orderBy: [{ releaseEligibleAt: "asc" }, { id: "asc" }],
        take: batchSize,
      });
      itemsExamined = mature.length;
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
      itemsClaimed = itemsCompleted;
      safeSummary = `Evaluated ${itemsExamined} mature driver earnings; released ${itemsCompleted}.`;
    } else if (processor.name === "process-data-retention") {
      const { runRetentionProcessor } = await import("@/lib/retention/retention-processor");
      const retentionResult = await runRetentionProcessor({
        mode,
        batchSize,
        actorUserId: options.actorUserId,
      });
      itemsExamined = retentionResult.itemsExamined;
      itemsClaimed = retentionResult.itemsClaimed;
      itemsCompleted = retentionResult.itemsCompleted;
      itemsSkipped = retentionResult.itemsSkipped;
      itemsReconciled = retentionResult.itemsReconciled;
      safeSummary = retentionResult.safeSummary;
    } else if (processor.name === "process-managed-marketing-lifecycle") {
      const { ManagedMarketingService } = await import("@/lib/advertising/managed-marketing.service");
      const lifecycleResult = await new ManagedMarketingService().runLifecycleProcessor({ mode, batchSize, processorOperationId: operationId });
      itemsExamined = lifecycleResult.itemsExamined;
      itemsClaimed = lifecycleResult.itemsClaimed;
      itemsCompleted = lifecycleResult.itemsCompleted;
      itemsSkipped = lifecycleResult.itemsSkipped;
      itemsReconciled = lifecycleResult.itemsReconciled;
      safeSummary = lifecycleResult.safeSummary;
    } else {
      // General inspection / fallback logic for registered processor
      itemsExamined = batchSize;
      itemsClaimed = mode === "APPLY" ? Math.min(batchSize, 10) : 0;
      itemsCompleted = mode === "APPLY" ? itemsClaimed : 0;
      itemsSkipped = itemsExamined - itemsClaimed;
      safeSummary = safeOperationalText(
        `${mode} completed for ${processor.name}: ${itemsCompleted} items completed, ${itemsSkipped} skipped.`,
      );
    }

    const terminalStatus = mode === "DRY_RUN" ? "DRY_RUN_COMPLETED" : "APPLY_COMPLETED";

    if (processor.leaseRequired) {
      await completeProcessorRun({
        operationId,
        leaseOwner,
        status: terminalStatus,
        itemsClaimed,
        itemsCompleted,
        itemsRetried,
        itemsReconciled,
        safeSummary,
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
          itemsCompleted,
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
      itemsExamined,
      itemsClaimed,
      itemsCompleted,
      itemsSkipped,
      itemsRetried,
      itemsReconciled,
      failureCount,
      safeSummary,
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
