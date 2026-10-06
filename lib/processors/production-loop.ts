import { randomUUID } from "node:crypto";
import type { ImplementedProcessorName } from "./processor-registry";

// Only the approved payment inbox/outbox and email delivery are automatic.
// Retention, settlements and commercial programmes require separate activation.
export const productionProcessors = [
  "apply-paystack-webhook-events",
  "consume-verified-payment-events",
  "deliver-notifications",
] as const satisfies readonly ImplementedProcessorName[];

export type ProductionProcessor = typeof productionProcessors[number];
type Executor = (input: { name: ProductionProcessor; mode: "APPLY"; operationId: string }) => Promise<{ itemsCompleted: number; itemsRetried: number }>;

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
