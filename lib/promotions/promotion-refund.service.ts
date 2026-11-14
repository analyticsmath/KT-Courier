import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import type { LineAllocationEvidence } from './promotion-allocation-policy';
import { reversePromotionBudgetForAdjustment } from './promotion-adjustment-reversal';
import { cumulativeLineAllocation, promotionLineRefund } from '@/lib/store-orders/allocation';

export interface PromotionRefundContext {
  refundId: string;
  storeOrderId: string;
  lineReference: string;
  refundProportion: Decimal;
  lineTotal: Decimal;
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
  const line = await tx.marketplaceOrderLine.findFirst({ where: { marketplaceStoreOrderId: context.storeOrderId, checkoutLineSnapshotId: context.lineReference } });
  const lines = adjustment.allocations.filter(item => item.allocationType === 'SELLER_BASIS');
  if (!line || lines.length !== 1 || lines[0].marketplaceOrderLineId !== line.id || !adjustment.deliveryFeeAmount.isZero() || lines[0].originalQuantity !== line.quantity) throw new Error('Refund adjustment does not identify exactly one original merchandise line.');
  const item = lines[0];
  const affectedQuantity = item.resolvedQuantityAfter - item.resolvedQuantityBefore;
  const proportion = new Decimal(affectedQuantity).div(line.quantity);
  if (!proportion.toDecimalPlaces(12).equals(context.refundProportion.toDecimalPlaces(12)) || !line.lineTotal.equals(context.lineTotal)) throw new Error('Refund quantities do not match the frozen order.');
  const redemptions = await tx.promotionRedemption.findMany({ where: { marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId }, include: { allocations: true } });
  const target = redemptions.find(row => row.id === context.redemptionId);
  if (!target) throw new Error('Promotion redemption does not belong to the refunded order.');
  const matching = redemptions.flatMap(row => row.allocations).filter(row => row.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId && row.lineReference === context.lineReference && row.allocationType === 'MERCHANDISE');
  if (!matching.length || !target.allocations.some(row => matching.some(allocation => allocation.id === row.id))) throw new Error('Frozen promotion allocation is unavailable.');
  const platform = matching.reduce((sum, row) => sum.add(row.platformFunding), new Decimal(0));
  const store = matching.reduce((sum, row) => sum.add(row.storeFunding), new Decimal(0));
  const originalCharge = line.effectiveUnitPrice.mul(affectedQuantity).toFixed(2);
  const calculated = promotionLineRefund({ originalCharge, platformFunding: platform.toFixed(2), storeFunding: store.toFixed(2), originalQuantity: line.quantity, previouslyResolvedQuantity: item.resolvedQuantityBefore, resolvedQuantityAfter: item.resolvedQuantityAfter });
  if (!refund.amount.equals(calculated.customerRefund) || !item.amount.equals(calculated.sellerBasisRefund)) throw new Error('Refund amount does not match the frozen promotion funding.');
  const targetAllocations = target.allocations.filter(row => row.storeGroupReference === adjustment.storeOrder.checkoutStoreGroupId && row.lineReference === context.lineReference && row.allocationType === 'MERCHANDISE');
  const proportional = (amount: Decimal) => new Decimal(cumulativeLineAllocation({ totalAmount: amount.toFixed(2), originalQuantity: line.quantity, previouslyResolvedQuantity: item.resolvedQuantityBefore, resolvedQuantityAfter: item.resolvedQuantityAfter }));
  const targetPlatform = targetAllocations.reduce((sum, row) => sum.add(proportional(row.platformFunding)), new Decimal(0));
  const targetStore = targetAllocations.reduce((sum, row) => sum.add(proportional(row.storeFunding)), new Decimal(0));
  const existing = await tx.promotionOperation.findUnique({ where: { operationId: context.operationId } });
  if (existing && (existing.operationType !== 'REVERSAL' || existing.requestHash !== context.requestHash || existing.resultReference !== target.id)) throw new Error('Promotion refund operation conflicts with its original evidence.');
  await reversePromotionBudgetForAdjustment(tx, { adjustmentId: adjustment.id, storeOrderId: context.storeOrderId, marketplaceOrderId: adjustment.storeOrder.marketplaceOrderId, checkoutStoreGroupId: adjustment.storeOrder.checkoutStoreGroupId, deliveryFeeAmount: adjustment.deliveryFeeAmount, allocations: adjustment.allocations });
  if (!existing) await tx.promotionOperation.create({ data: { operationId: context.operationId, requestHash: context.requestHash, operationType: 'REVERSAL', resultReference: target.id } });
  return { customerRefundAmount: new Decimal(calculated.customerRefund), platformSubventionReversal: targetPlatform, storeBasisReversal: targetStore, budgetReversalAmount: targetPlatform.plus(targetStore), restorationPolicy: target.redemptionReusePolicy, restored: false, operationId: context.operationId };
}
