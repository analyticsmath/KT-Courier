import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { initializeMarketplaceStoreOrderOperations } from "@/lib/store-orders/store-order.service";
import { createPrismaMarketplaceReservationRepository } from "./prisma-marketplace-reservation.repository";
import { expireMarketplaceCheckoutReservation } from "./inventory-reservation.service";
import type { ProcessorHandlerContext, ProcessorHandlerOutcome } from "@/lib/processors/processor-service";

type Batch = Pick<ProcessorHandlerContext, "mode" | "batchSize">;
const outcome = (itemsExamined: number): ProcessorHandlerOutcome => ({ itemsExamined, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: 0, itemsRetried: 0, itemsReconciled: 0, safeSummary: "" });
export function uninitializedMarketplaceOrdersWhere(): Prisma.MarketplaceStoreOrderWhereInput {
  return { operationalPolicyId: null, status: { in: ["SETTLED", "PENDING_SETTLEMENT"] },
    marketplaceOrder: { payment: { status: "SUCCEEDED" } },
    OR: [{ status: "SETTLED" }, { marketplaceOrder: { cashRequired: { gt: 0 } } }],
  };
}
export function expiredMarketplaceReservationsWhere(now = new Date()): Prisma.MarketplaceInventoryReservationWhereInput {
  return { status: "ACTIVE", expiresAt: { lte: now }, checkout: { payment: null } };
}
export async function initializeMarketplaceOrdersBatch({ mode, batchSize }: Batch): Promise<ProcessorHandlerOutcome> {
  const orders = await prisma.marketplaceStoreOrder.findMany({ where: uninitializedMarketplaceOrdersWhere(), select: { publicReference: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: batchSize });
  const result = outcome(orders.length);
  for (const order of orders) {
    if (mode === "DRY_RUN") { result.itemsSkipped++; continue; }
    const operationId = `marketplace-initialize:${order.publicReference}`;
    try {
      result.itemsClaimed++;
      await initializeMarketplaceStoreOrderOperations({ storeOrderReference: order.publicReference, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") });
      result.itemsCompleted++;
    } catch { result.itemsRetried++; }
  }
  result.safeSummary = `${mode}: marketplace operations initialized ${result.itemsCompleted}; ${result.itemsRetried} remain pending; ${result.itemsSkipped} unchanged.`;
  return result;
}
export async function expireMarketplaceReservationsBatch({ mode, batchSize }: Batch): Promise<ProcessorHandlerOutcome> {
  const now = new Date();
  const reservations = await prisma.marketplaceInventoryReservation.findMany({ where: expiredMarketplaceReservationsWhere(now), select: { id: true, checkoutId: true, publicReference: true }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: batchSize });
  const result = outcome(reservations.length);
  const repository = mode === "APPLY" ? createPrismaMarketplaceReservationRepository() : null;
  for (const candidate of reservations) {
    if (!repository) { result.itemsSkipped++; continue; }
    try {
      const reservation = await repository.findActiveReservation(candidate.checkoutId);
      if (!reservation || reservation.id !== candidate.id) { result.itemsSkipped++; continue; }
      result.itemsClaimed++;
      const expired = await expireMarketplaceCheckoutReservation(repository, reservation, now, `marketplace-expiry:${candidate.publicReference}`);
      if (expired) result.itemsCompleted++; else result.itemsSkipped++;
    } catch { result.itemsRetried++; }
  }
  result.safeSummary = `${mode}: checkout reservations expired ${result.itemsCompleted}; ${result.itemsRetried} remain pending; ${result.itemsSkipped} unchanged.`;
  return result;
}
