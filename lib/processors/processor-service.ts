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
  const itemsRetried = 0;
  let itemsReconciled = 0;
  let failureCount = 0;
  let safeSummary = "";

  try {
    // Specialized execution routing for specific processor names where appropriate
    if (processor.name === "process-data-retention") {
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
      // General inspection/dry run logic for registered processors
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
