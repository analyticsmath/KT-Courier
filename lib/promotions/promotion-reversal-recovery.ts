import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPromotionsProductionReady } from "./production-lock";
import { applyPromotionRefundAdjustment } from "./promotion-refund.service";

/** Reconcile completed single-line refunds through the canonical refund authority. */
export async function recoverPromotionReversals({ limit = 100, after, apply = false }: { limit?: number; after?: string; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid promotion reversal scan parameters.");
  if (apply) assertPromotionsProductionReady("REVERSAL");
  const rows = await prisma.marketplaceStoreOrderAdjustment.findMany({
    where: { status: { in: ["REFUND_PENDING", "COMPLETED"] }, refund: { is: { status: "SUCCEEDED" } }, ...(after ? { id: { gt: after } } : {}) },
    include: { allocations: true, storeOrder: { select: { marketplaceOrderId: true, checkoutStoreGroupId: true } } }, orderBy: { id: "asc" }, take: limit + 1,
  });
  const page = rows.slice(0, limit);
  let eligible = 0, completed = 0, failed = 0, review = 0;
  for (const adjustment of page) {
    const redemptions = await prisma.promotionRedemption.findMany({ where: { marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId }, include: { allocations: true } });
    if (!redemptions.length) continue;
    const source = adjustment.allocations.filter(item => item.allocationType === "SELLER_BASIS");
    if (!adjustment.refundId || !adjustment.deliveryFeeAmount.isZero() || source.length !== 1 || !source[0].marketplaceOrderLineId) { review++; continue; }
    const line = await prisma.marketplaceOrderLine.findFirst({ where: { id: source[0].marketplaceOrderLineId, marketplaceStoreOrderId: adjustment.marketplaceStoreOrderId }, select: { checkoutLineSnapshotId: true, quantity: true, lineTotal: true } });
    if (!line || source[0].originalQuantity !== line.quantity || line.quantity < 1) { review++; continue; }
    const targets = redemptions.filter(redemption => redemption.allocations.some(allocation => allocation.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId && allocation.lineReference === line.checkoutLineSnapshotId && allocation.allocationType === "MERCHANDISE"));
    if (!targets.length) continue;
    eligible++;
    if (!apply) continue;
    try {
      await prisma.$transaction(async tx => {
        for (const target of targets) {
          const digest = createHash("sha256").update(`${adjustment.id}:${target.id}`).digest("hex");
          await applyPromotionRefundAdjustment({ refundId: adjustment.refundId!, storeOrderId: adjustment.marketplaceStoreOrderId, lineReference: line.checkoutLineSnapshotId, refundProportion: new Prisma.Decimal(source[0].resolvedQuantityAfter - source[0].resolvedQuantityBefore).div(line.quantity), lineTotal: line.lineTotal, frozenPromotionAllocations: [], redemptionId: target.id, operationId: `promotion-refund-recovery:${digest}`, requestHash: digest }, tx);
        }
      }, { isolationLevel: "Serializable" });
      completed++;
    } catch { failed++; }
  }
  return { examined: page.length, eligible, completed, failed, review, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
