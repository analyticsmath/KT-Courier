import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { promotionLineRefund } from "@/lib/store-orders/allocation";
import { assertPromotionsProductionReady } from "./production-lock";
import { applyPromotionRefundAdjustment, type PromotionRefundLineContext } from "./promotion-refund.service";

export interface PromotionReversalReviewItem {
  adjustmentId: string;
  refundId: string | null;
  reasonCode: string;
}

/** Reconcile completed single-line and multi-line merchandise refunds through the canonical refund authority. */
export async function recoverPromotionReversals({ limit = 100, after, apply = false }: { limit?: number; after?: string; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid promotion reversal scan parameters.");
  if (apply) assertPromotionsProductionReady("REVERSAL");
  const rows = await prisma.marketplaceStoreOrderAdjustment.findMany({
    where: { status: { in: ["REFUND_PENDING", "COMPLETED"] }, refund: { is: { status: "SUCCEEDED" } }, ...(after ? { id: { gt: after } } : {}) },
    include: {
      allocations: true,
      refund: { include: { completionLedgerJournal: true } },
      storeOrder: { select: { marketplaceOrderId: true, checkoutStoreGroupId: true, marketplaceOrder: { select: { paymentId: true, customerUserId: true } } } },
    },
    orderBy: { id: "asc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  let eligible = 0, completed = 0, failed = 0, review = 0;
  const reviewItems: PromotionReversalReviewItem[] = [];
  const markReview = (adjustmentId: string, refundId: string | null | undefined, reasonCode: string) => {
    review++;
    reviewItems.push({ adjustmentId, refundId: refundId ?? null, reasonCode });
  };
  for (const adjustment of page) {
    const redemptions = await prisma.promotionRedemption.findMany({ where: { marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId }, include: { allocations: true } });
    if (!redemptions.length) continue;
    if (redemptions.some(redemption => !redemption.allocations?.length)) {
      markReview(adjustment.id, adjustment.refundId, "REDEMPTION_ALLOCATIONS_MISSING");
      continue;
    }
    const source = adjustment.allocations.filter(item => item.allocationType === "SELLER_BASIS");
    if (
      !adjustment.refundId ||
      !adjustment.deliveryFeeAmount.isZero() ||
      source.length < 1 ||
      source.length > 50 ||
      (adjustment.adjustmentType === "SUBSTITUTION" && source.length > 1) ||
      source.some(item =>
        !item.marketplaceOrderLineId ||
        !Number.isSafeInteger(item.originalQuantity) ||
        item.originalQuantity < 1 ||
        !Number.isSafeInteger(item.resolvedQuantityBefore) ||
        !Number.isSafeInteger(item.resolvedQuantityAfter) ||
        item.resolvedQuantityBefore < 0 ||
        item.resolvedQuantityAfter <= item.resolvedQuantityBefore ||
        item.resolvedQuantityAfter > item.originalQuantity
      ) ||
      new Set(source.map(item => item.marketplaceOrderLineId)).size !== source.length
    ) {
      markReview(adjustment.id, adjustment.refundId, !adjustment.deliveryFeeAmount.isZero() ? "DELIVERY_FEE_ADJUSTMENT_REQUIRES_REVIEW" : "ADJUSTMENT_LINE_EVIDENCE_INVALID");
      continue;
    }
    if (adjustment.refund !== undefined) {
      const refund = adjustment.refund;
      const journal = refund?.completionLedgerJournal;
      const order = adjustment.storeOrder.marketplaceOrder;
      if (
        !refund ||
        refund.status !== "SUCCEEDED" ||
        !refund.completedAt ||
        !journal ||
        !["REFUND_EXTERNAL_PAYOUT", "REFUND_WALLET_CREDIT"].includes(journal.type) ||
        !journal.totalDebits.equals(refund.amount) ||
        !journal.totalCredits.equals(refund.amount) ||
        (order && (refund.paymentId !== order.paymentId || refund.customerUserId !== order.customerUserId)) ||
        (adjustment.refundAmount !== undefined && !new Prisma.Decimal(adjustment.refundAmount).equals(refund.amount))
      ) {
        markReview(adjustment.id, adjustment.refundId, "REFUND_JOURNAL_EVIDENCE_INVALID");
        continue;
      }
    }
    const resolvedLines: Array<{
      item: (typeof source)[number];
      line: { id?: string; checkoutLineSnapshotId: string; quantity: number; lineTotal: Prisma.Decimal; effectiveUnitPrice?: Prisma.Decimal };
    }> = [];
    let lineEvidenceValid = true;
    for (const item of source) {
      const line = await prisma.marketplaceOrderLine.findFirst({
        where: { id: item.marketplaceOrderLineId!, marketplaceStoreOrderId: adjustment.marketplaceStoreOrderId },
        select: { id: true, checkoutLineSnapshotId: true, quantity: true, lineTotal: true, effectiveUnitPrice: true },
      });
      if (
        !line ||
        !line.checkoutLineSnapshotId ||
        item.originalQuantity !== line.quantity ||
        line.quantity < 1 ||
        (line.id !== undefined && line.id !== item.marketplaceOrderLineId)
      ) {
        lineEvidenceValid = false;
        break;
      }
      resolvedLines.push({ item, line });
    }
    if (!lineEvidenceValid || new Set(resolvedLines.map(entry => entry.line.checkoutLineSnapshotId)).size !== resolvedLines.length) {
      markReview(adjustment.id, adjustment.refundId, "ORDER_LINE_MISMATCH");
      continue;
    }
    const snapshotIds = new Set(resolvedLines.map(entry => entry.line.checkoutLineSnapshotId));
    const targets = redemptions.filter(redemption =>
      redemption.allocations.some(allocation =>
        allocation.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId &&
        allocation.lineReference !== null &&
        snapshotIds.has(allocation.lineReference) &&
        allocation.allocationType === "MERCHANDISE"
      )
    );
    if (!targets.length) continue;
    const hasMonetaryFields =
      adjustment.refundAmount !== undefined &&
      resolvedLines.every(({ item, line }) => item.amount !== undefined && line.effectiveUnitPrice !== undefined) &&
      redemptions.every(redemption => redemption.allocations.every(allocation => allocation.platformFunding !== undefined && allocation.storeFunding !== undefined));
    if (hasMonetaryFields) {
      const evidence = adjustment.financialEvidence as Record<string, unknown> | null | undefined;
      const replacementCharge = adjustment.adjustmentType === "SUBSTITUTION"
        ? (evidence && typeof evidence === "object" && !Array.isArray(evidence) ? evidence.replacementCharge : undefined)
        : "0.00";
      let totalCustomerRefund = new Prisma.Decimal(0);
      let monetaryValid = typeof replacementCharge === "string";
      if (monetaryValid) {
        for (const { item, line } of resolvedLines) {
          const affectedQuantity = item.resolvedQuantityAfter - item.resolvedQuantityBefore;
          if (!line.effectiveUnitPrice!.mul(line.quantity).equals(line.lineTotal)) {
            monetaryValid = false;
            break;
          }
          const matching = redemptions.flatMap(row => row.allocations).filter(row =>
            row.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId &&
            row.lineReference === line.checkoutLineSnapshotId &&
            row.allocationType === "MERCHANDISE"
          );
          if (
            (resolvedLines.length === 1 && !matching.length) ||
            matching.some(row => row.discountAmount !== undefined && !new Prisma.Decimal(row.platformFunding).add(row.storeFunding).equals(row.discountAmount))
          ) {
            monetaryValid = false;
            break;
          }
          const platform = matching.reduce((sum, row) => sum.add(row.platformFunding), new Prisma.Decimal(0));
          const store = matching.reduce((sum, row) => sum.add(row.storeFunding), new Prisma.Decimal(0));
          try {
            const calculated = promotionLineRefund({
              originalCharge: line.effectiveUnitPrice!.mul(affectedQuantity).toFixed(2),
              platformFunding: platform.toFixed(2),
              storeFunding: store.toFixed(2),
              originalQuantity: line.quantity,
              previouslyResolvedQuantity: item.resolvedQuantityBefore,
              resolvedQuantityAfter: item.resolvedQuantityAfter,
              replacementCharge: replacementCharge as string,
            });
            if (!new Prisma.Decimal(item.amount).equals(calculated.sellerBasisRefund)) {
              monetaryValid = false;
              break;
            }
            totalCustomerRefund = totalCustomerRefund.add(calculated.customerRefund);
          } catch {
            monetaryValid = false;
            break;
          }
        }
      }
      if (!monetaryValid || !new Prisma.Decimal(adjustment.refundAmount).equals(totalCustomerRefund)) {
        markReview(adjustment.id, adjustment.refundId, "REFUND_AMOUNT_OR_FUNDING_MISMATCH");
        continue;
      }
    }
    const lineContexts: PromotionRefundLineContext[] = resolvedLines.map(({ item, line }) => ({
      lineReference: line.checkoutLineSnapshotId,
      refundProportion: new Prisma.Decimal(item.resolvedQuantityAfter - item.resolvedQuantityBefore).div(line.quantity),
      lineTotal: line.lineTotal,
    }));
    eligible++;
    if (!apply) continue;
    try {
      await prisma.$transaction(async tx => {
        for (const target of targets) {
          const digest = createHash("sha256").update(`${adjustment.id}:${target.id}`).digest("hex");
          await applyPromotionRefundAdjustment({
            refundId: adjustment.refundId!,
            storeOrderId: adjustment.marketplaceStoreOrderId,
            lineReference: lineContexts[0].lineReference,
            refundProportion: lineContexts[0].refundProportion,
            lineTotal: lineContexts[0].lineTotal,
            ...(lineContexts.length > 1 ? { lines: lineContexts } : {}),
            frozenPromotionAllocations: [],
            redemptionId: target.id,
            operationId: `promotion-refund-recovery:${digest}`,
            requestHash: digest,
          }, tx);
        }
      }, { isolationLevel: "Serializable" });
      completed++;
    } catch { failed++; }
  }
  return { examined: page.length, eligible, completed, failed, review, reviewItems, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
