import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPrismaMarketplaceSettlementRepository } from "./prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "./settlement.service";
import type { ProcessorHandlerContext, ProcessorHandlerOutcome } from "@/lib/processors/processor-service";

/** Cash checkout settlement waits for the source shipment's actual bank remittance.
 * Pending collection is normal work, not a failed settlement or reconciliation incident. */
export function dueMarketplaceSettlementJobsWhere(now = new Date()): Prisma.MarketplaceStoreSettlementJobWhereInput {
  return {
    status: { in: ["PENDING", "RETRYABLE"] }, nextAttemptAt: { lte: now },
    marketplaceStoreOrder: {
      operationalScope: "LIVE",
      acceptanceStatus: { notIn: ["REJECTED", "TIMED_OUT"] },
      preparationStatus: { not: "ABORTED" },
      OR: [
        { marketplaceOrder: { cashRequired: 0 } },
        { deliveryBridge: { courierOrder: { cashOnDelivery: { status: "RECONCILED", remittanceDiscrepancy: 0 } } } },
      ],
    },
  };
}

/** Drain durable finalization jobs through the canonical, transactionally idempotent settlement authority. */
export async function runMarketplaceSettlementBatch(input: Pick<ProcessorHandlerContext, "mode" | "batchSize">): Promise<ProcessorHandlerOutcome> {
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 100) throw new Error("Settlement batch size must be between 1 and 100.");
  const jobs = await prisma.marketplaceStoreSettlementJob.findMany({
    where: dueMarketplaceSettlementJobsWhere(),
    include: { marketplaceStoreOrder: { select: { publicReference: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: input.batchSize,
  });
  const result = { itemsExamined: jobs.length, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: 0, itemsRetried: 0, itemsReconciled: 0, safeSummary: "" };
  if (input.mode === "DRY_RUN") {
    result.itemsSkipped = jobs.length;
    result.safeSummary = `[DRY_RUN] Evaluated ${jobs.length} due marketplace settlements; 0 mutated.`;
    return result;
  }
  for (const job of jobs) {
    result.itemsClaimed++;
    try {
      await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: job.marketplaceStoreOrder.publicReference, operationId: job.operationId }, createPrismaMarketplaceSettlementRepository());
      result.itemsCompleted++;
    } catch (error) {
      if ((error as { code?: string })?.code === "SETTLEMENT_AWAITING_CASH") { result.itemsSkipped++; continue; }
      // The canonical service persists retry/reconciliation evidence after rollback.
      // Never turn an unrecorded failure (including an unavailable database) into a successful processor run.
      const recovery = await prisma.marketplaceStoreSettlementJob.findUnique({ where: { id: job.id }, select: { status: true } });
      if (recovery?.status === "RETRYABLE") result.itemsRetried++;
      else if (recovery?.status === "RECONCILIATION_REQUIRED") result.itemsReconciled++;
      else throw error;
    }
  }
  result.safeSummary = `Marketplace settlements: ${result.itemsCompleted} completed, ${result.itemsRetried} scheduled for retry, ${result.itemsReconciled} require reconciliation.`;
  return result;
}
