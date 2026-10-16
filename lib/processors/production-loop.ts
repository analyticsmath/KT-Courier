import { randomUUID } from "node:crypto";
import type { ImplementedProcessorName } from "./processor-registry";

// Canonical payment, marketplace settlement and notification queues run automatically.
// External payout execution and commercial programmes retain their separate approval gates.
export const productionProcessors = [
  "apply-paystack-webhook-events",
  "consume-verified-payment-events",
  "settle-marketplace-store-orders",
  "initialize-marketplace-store-orders",
  "expire-marketplace-reservations",
  "process-earning-lifecycle",
  "deliver-notifications",
  "reconcile-expired-dispatch",
  "dispatch-marketplace-orders",
] as const satisfies readonly ImplementedProcessorName[];

export type ProductionCycleResult = Readonly<{
  name: ProductionProcessor;
  status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE";
  itemsCompleted: number;
  itemsRetried: number;
}>;

export function summarizeProductionCycleReadiness(results: readonly ProductionCycleResult[], blockers: readonly string[] = []) {
  const readinessBlockers = [...new Set(blockers)].sort();
  return {
    healthy: results.length === productionProcessors.length &&
      results.every((result) => result.status !== "FAILED" && result.itemsRetried === 0) &&
      readinessBlockers.length === 0,
    readinessBlockers,
  };
}

export type ProductionProcessor = typeof productionProcessors[number];
type Executor = (input: { name: ProductionProcessor; mode: "APPLY"; operationId: string }) => Promise<{ itemsCompleted: number; itemsRetried: number }>;
type WorkCheck = (name: ProductionProcessor) => Promise<boolean>;

export const DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS: Readonly<Partial<Record<ProductionProcessor, number>>> = {
  "reconcile-expired-dispatch": 60_000,
  "dispatch-marketplace-orders": 60_000,
};

export interface ProcessorCadenceTracker {
  isDue(name: ProductionProcessor, now?: number): boolean;
  markChecked(name: ProductionProcessor, now?: number): void;
  reset(): void;
}

export function createProcessorCadenceTracker(
  cadences: Partial<Record<ProductionProcessor, number>> = DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS,
  nowFn: () => number = () => Date.now(),
): ProcessorCadenceTracker {
  const lastCheckedAt = new Map<ProductionProcessor, number>();
  return {
    isDue(name: ProductionProcessor, now = nowFn()): boolean {
      const minInterval = cadences[name];
      if (!minInterval) return true;
      const last = lastCheckedAt.get(name) ?? 0;
      return now - last >= minInterval;
    },
    markChecked(name: ProductionProcessor, now = nowFn()): void {
      lastCheckedAt.set(name, now);
    },
    reset(): void {
      lastCheckedAt.clear();
    },
  };
}

/** Avoid a full empty-queue sweep during worker startup, but let the earning
 * lifecycle make its first cursor pass so persisted cursors can wrap safely.
 * Cadence-configured processors can be throttled via an optional cadence tracker. */
export function createProductionCycleWorkCheck(
  hasWork: WorkCheck,
  firstCycle: boolean,
  cadenceTracker?: ProcessorCadenceTracker,
): WorkCheck {
  return async (name) => {
    if (cadenceTracker && !cadenceTracker.isDue(name)) return false;
    if (cadenceTracker) cadenceTracker.markChecked(name);
    if (firstCycle && name === "process-earning-lifecycle") return true;
    return hasWork(name);
  };
}

export async function runProductionCycle(execute: Executor, stopping: () => boolean = () => false, hasWork?: (name: ProductionProcessor) => Promise<boolean>) {
  const results: { name: ProductionProcessor; status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE"; itemsCompleted: number; itemsRetried: number }[] = [];
  for (const name of productionProcessors) {
    if (stopping()) break;
    try {
      if (hasWork && !await hasWork(name)) {
        results.push({ name, status: "IDLE", itemsCompleted: 0, itemsRetried: 0 });
        continue;
      }
      const result = await execute({ name, mode: "APPLY", operationId: `PROD-${randomUUID()}` });
      results.push({ name, status: "COMPLETED", itemsCompleted: result.itemsCompleted, itemsRetried: result.itemsRetried });
    } catch (error) {
      const peerLease = error instanceof Error && /Active unexpired lease|Concurrent lease acquisition/.test(error.message);
      results.push({ name, status: peerLease ? "PEER_LEASE" : "FAILED", itemsCompleted: 0, itemsRetried: 0 });
    }
  }
  return results;
}
