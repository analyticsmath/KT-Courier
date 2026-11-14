import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import type { LineAllocationEvidence } from './promotion-allocation-policy';
import { reversePromotionBudgetForAdjustment } from './promotion-adjustment-reversal';
import { cumulativeLineAllocation, promotionLineRefund } from '@/lib/store-orders/allocation';

export interface PromotionRefundLineContext {
  lineReference: string;
  refundProportion: Decimal;
  lineTotal: Decimal;
}
export interface PromotionRefundContext {
  refundId: string;
  storeOrderId: string;
  lineReference: string;
  refundProportion: Decimal;
  lineTotal: Decimal;
  lines?: readonly PromotionRefundLineContext[];
  frozenPromotionAllocations: LineAllocationEvidence[];
  redemptionId: string;
  operationId: string;
  requestHash: string;
}
export interface PromotionRefundResult {
  customerRefundAmount: Decimal;
  platformSubventionReversal: Decimal;
  storeBasisReversal: Decimal;
  budgetReversalAmount: Decimal;
  restorationPolicy: 'NEVER_RESTORE' | 'RESTORE_ON_DEFINITE_PRE_FULFILMENT_CANCELLATION' | 'ADMIN_REVIEW_REQUIRED';
  restored: boolean;
  operationId: string;
}
type PrismaTransactionClient = Prisma.TransactionClient;

/** Reconcile a completed refund only against its immutable store adjustment and redemption. */
export async function applyPromotionRefundAdjustment(context: PromotionRefundContext, tx: PrismaTransactionClient): Promise<PromotionRefundResult> {
  assertPromotionsProductionReady('REVERSAL');
  if (!context.operationId?.trim() || !context.requestHash?.trim()) throw new Error('A stable refund operation is required.');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`promotion-refund:${context.operationId}`},0))::text`;
  const candidate = await tx.marketplaceStoreOrderAdjustment.findFirst({
    where: { refundId: context.refundId, marketplaceStoreOrderId: context.storeOrderId, status: { in: ['REFUND_PENDING', 'COMPLETED'] } },
    select: { id: true },
  });
  if (!candidate) throw new Error('A matching approved store adjustment and refund are required.');
  await tx.$queryRaw`SELECT id FROM "MarketplaceStoreOrderAdjustment" WHERE id=${candidate.id} FOR UPDATE`;
  const adjustment = await tx.marketplaceStoreOrderAdjustment.findFirst({
    where: { id: candidate.id, refundId: context.refundId, marketplaceStoreOrderId: context.storeOrderId, status: { in: ['REFUND_PENDING', 'COMPLETED'] } },
    include: { allocations: true, refund: { include: { completionLedgerJournal: true } }, storeOrder: { include: { marketplaceOrder: true } } },
  });
  if (!adjustment) throw new Error('A matching approved store adjustment and refund are required.');
  const refund = await tx.paymentRefund.findUnique({ where: { id: context.refundId }, include: { completionLedgerJournal: true } });
  if (!refund || refund.status !== 'SUCCEEDED' || !refund.completedAt || !refund.completionLedgerJournal || !['REFUND_EXTERNAL_PAYOUT', 'REFUND_WALLET_CREDIT'].includes(refund.completionLedgerJournal.type) || !refund.completionLedgerJournal.totalDebits.equals(refund.amount) || !refund.completionLedgerJournal.totalCredits.equals(refund.amount) || refund.paymentId !== adjustment.storeOrder.marketplaceOrder.paymentId || refund.customerUserId !== adjustment.storeOrder.marketplaceOrder.customerUserId || !adjustment.refundAmount.equals(refund.amount)) throw new Error('Verified refund payment evidence is required.');
  const requestedLines: readonly PromotionRefundLineContext[] = context.lines?.length
    ? context.lines
    : [{ lineReference: context.lineReference, refundProportion: context.refundProportion, lineTotal: context.lineTotal }];
  const lines = adjustment.allocations.filter(item => item.allocationType === 'SELLER_BASIS');
  if (!lines.length || lines.length !== requestedLines.length || !adjustment.deliveryFeeAmount.isZero() || lines.some(item => !item.marketplaceOrderLineId) || new Set(lines.map(item => item.marketplaceOrderLineId)).size !== lines.length || requestedLines.some(item => !item.lineReference?.trim()) || new Set(requestedLines.map(item => item.lineReference)).size !== requestedLines.length) {
    throw new Error('Refund adjustment does not identify valid original merchandise lines.');
  }
  const resolvedLines: Array<{
    reqLine: PromotionRefundLineContext;
    line: NonNullable<Awaited<ReturnType<typeof tx.marketplaceOrderLine.findFirst>>>;
    item: (typeof lines)[number];
    affectedQuantity: number;
  }> = [];
  for (const reqLine of requestedLines) {
    const line = await tx.marketplaceOrderLine.findFirst({ where: { marketplaceStoreOrderId: context.storeOrderId, checkoutLineSnapshotId: reqLine.lineReference } });
    const item = line ? lines.find(row => row.marketplaceOrderLineId === line.id) : undefined;
    if (!line || !item || item.originalQuantity !== line.quantity || line.quantity < 1) {
      throw new Error('Refund adjustment does not identify valid original merchandise lines.');
    }
    const affectedQuantity = item.resolvedQuantityAfter - item.resolvedQuantityBefore;
    if (!Number.isSafeInteger(item.resolvedQuantityBefore) || !Number.isSafeInteger(item.resolvedQuantityAfter) || item.resolvedQuantityBefore < 0 || affectedQuantity <= 0 || item.resolvedQuantityAfter > line.quantity) {
      throw new Error('Refund quantities do not match the frozen order.');
    }
    const proportion = new Decimal(affectedQuantity).div(line.quantity);
    if (!proportion.toDecimalPlaces(12).equals(reqLine.refundProportion.toDecimalPlaces(12)) || !line.lineTotal.equals(reqLine.lineTotal) || !line.effectiveUnitPrice.mul(line.quantity).equals(line.lineTotal)) {
      throw new Error('Refund quantities do not match the frozen order.');
    }
    resolvedLines.push({ reqLine, line, item, affectedQuantity });
  }
  if (new Set(resolvedLines.map(entry => entry.line.id)).size !== resolvedLines.length) {
    throw new Error('Refund adjustment does not identify valid original merchandise lines.');
  }
  const redemptions = await tx.promotionRedemption.findMany({ where: { marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId }, include: { allocations: true } });
  const target = redemptions.find(row => row.id === context.redemptionId);
  if (!target) throw new Error('Promotion redemption does not belong to the refunded order.');
  const evidence = adjustment.financialEvidence;
  const replacementCharge = adjustment.adjustmentType === 'SUBSTITUTION'
    ? (resolvedLines.length === 1 && evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? (evidence as Record<string, unknown>).replacementCharge : undefined)
    : '0.00';
  if (typeof replacementCharge !== 'string') throw new Error('Frozen replacement charge is unavailable.');
  let totalCustomerRefund = new Decimal(0);
  let targetPlatform = new Decimal(0);
  let targetStore = new Decimal(0);
  let targetMatchedAnyLine = false;
  for (const { reqLine, line, item, affectedQuantity } of resolvedLines) {
    const matching = redemptions.flatMap(row => row.allocations).filter(row => row.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId && row.lineReference === reqLine.lineReference && row.allocationType === 'MERCHANDISE');
    if (resolvedLines.length === 1 && (!matching.length || !target.allocations.some(row => matching.some(allocation => allocation.id === row.id)))) {
      throw new Error('Frozen promotion allocation is unavailable.');
    }
    if (matching.some(row => row.discountAmount !== undefined && !row.platformFunding.add(row.storeFunding).equals(row.discountAmount))) {
      throw new Error('Frozen promotion allocation is unavailable.');
    }
    const platform = matching.reduce((sum, row) => sum.add(row.platformFunding), new Decimal(0));
    const store = matching.reduce((sum, row) => sum.add(row.storeFunding), new Decimal(0));
    const originalCharge = line.effectiveUnitPrice.mul(affectedQuantity).toFixed(2);
    const calculated = promotionLineRefund({ originalCharge, platformFunding: platform.toFixed(2), storeFunding: store.toFixed(2), originalQuantity: line.quantity, previouslyResolvedQuantity: item.resolvedQuantityBefore, resolvedQuantityAfter: item.resolvedQuantityAfter, replacementCharge });
    if (!item.amount.equals(calculated.sellerBasisRefund)) throw new Error('Refund amount does not match the frozen promotion funding.');
    totalCustomerRefund = totalCustomerRefund.add(calculated.customerRefund);
    const targetAllocations = target.allocations.filter(row => row.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId && row.lineReference === reqLine.lineReference && row.allocationType === 'MERCHANDISE');
    if (targetAllocations.length > 0) {
      targetMatchedAnyLine = true;
      const proportional = (amount: Decimal) => new Decimal(cumulativeLineAllocation({ totalAmount: amount.toFixed(2), originalQuantity: line.quantity, previouslyResolvedQuantity: item.resolvedQuantityBefore, resolvedQuantityAfter: item.resolvedQuantityAfter }));
      targetPlatform = targetPlatform.add(targetAllocations.reduce((sum, row) => sum.add(proportional(row.platformFunding)), new Decimal(0)));
      targetStore = targetStore.add(targetAllocations.reduce((sum, row) => sum.add(proportional(row.storeFunding)), new Decimal(0)));
    }
  }
  if (!targetMatchedAnyLine) throw new Error('Frozen promotion allocation is unavailable.');
  if (!refund.amount.equals(totalCustomerRefund)) throw new Error('Refund amount does not match the frozen promotion funding.');
  const existing = await tx.promotionOperation.findUnique({ where: { operationId: context.operationId } });
  if (existing && (existing.operationType !== 'REVERSAL' || existing.requestHash !== context.requestHash || existing.resultReference !== target.id)) throw new Error('Promotion refund operation conflicts with its original evidence.');
  await reversePromotionBudgetForAdjustment(tx, { adjustmentId: adjustment.id, storeOrderId: context.storeOrderId, marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId, checkoutStoreGroupId: adjustment.storeOrder.checkoutStoreGroupId, deliveryFeeAmount: adjustment.deliveryFeeAmount, allocations: adjustment.allocations });
  if (!existing) await tx.promotionOperation.create({ data: { operationId: context.operationId, requestHash: context.requestHash, operationType: 'REVERSAL', resultReference: target.id } });
  return { customerRefundAmount: totalCustomerRefund, platformSubventionReversal: targetPlatform, storeBasisReversal: targetStore, budgetReversalAmount: targetPlatform.plus(targetStore), restorationPolicy: target.redemptionReusePolicy, restored: false, operationId: context.operationId };
}
