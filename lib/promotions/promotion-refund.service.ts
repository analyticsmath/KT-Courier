import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { calculateRefundAllocations } from './promotion-refund-policy';
import { recordBudgetMovement } from './promotion-budget.service';
import type { LineAllocationEvidence } from './promotion-allocation-policy';
import { lockBudgets, lockCampaignVersions } from './promotion-repositories';

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

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

export async function applyPromotionRefundAdjustment(context: PromotionRefundContext, tx: PrismaTransactionClient): Promise<PromotionRefundResult> {
  assertPromotionsProductionReady('REVERSAL');

  // Check idempotency first
  const existingOp = await tx.promotionOperation.findUnique({
    where: { operationId: context.operationId }
  });
  if (existingOp) {
    if (existingOp.requestHash !== context.requestHash) {
      throw new Error(`Conflict: Replay of operation ${context.operationId} with different hash.`);
    }
    // We can compute the result for replay
    const redemption = await tx.promotionRedemption.findUniqueOrThrow({
      where: { id: context.redemptionId }
    });
    const lineAllocations = context.frozenPromotionAllocations.filter(a => a.lineId === context.lineReference);
    let totalCustomerRefundAmount = new Decimal(0);
    let totalPlatformSubventionReversal = new Decimal(0);
    let totalStoreBasisReversal = new Decimal(0);
    let budgetReversalAmount = new Decimal(0);

    for (const allocation of lineAllocations) {
      const refundResult = calculateRefundAllocations({
        lineTotal: context.lineTotal,
        platformFundedDiscount: allocation.platformFunding,
        storeFundedDiscount: allocation.storeFunding,
        refundProportion: context.refundProportion,
      });
      totalCustomerRefundAmount = totalCustomerRefundAmount.plus(refundResult.customerRefundAmount);
      totalPlatformSubventionReversal = totalPlatformSubventionReversal.plus(refundResult.platformSubventionReversal);
      totalStoreBasisReversal = totalStoreBasisReversal.plus(refundResult.storeBasisReversal);
      budgetReversalAmount = budgetReversalAmount.plus(refundResult.platformSubventionReversal.plus(refundResult.storeBasisReversal));
    }
    if (lineAllocations.length === 0) {
      totalCustomerRefundAmount = context.lineTotal.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
    }
    return {
      customerRefundAmount: totalCustomerRefundAmount,
      platformSubventionReversal: totalPlatformSubventionReversal,
      storeBasisReversal: totalStoreBasisReversal,
      budgetReversalAmount,
      restorationPolicy: 'NEVER_RESTORE',
      restored: false,
      operationId: context.operationId,
    };
  }

  // 1. Lock Redemption and get campaign details
  const redemption = await tx.promotionRedemption.findUniqueOrThrow({
    where: { id: context.redemptionId }
  });

  // Lock Campaign Version and Budget
  await lockCampaignVersions([redemption.campaignVersionId], tx);
  const budget = await tx.promotionBudget.findUniqueOrThrow({
    where: { campaignVersionId: redemption.campaignVersionId }
  });
  await lockBudgets([budget.id], tx);

  const lineAllocations = context.frozenPromotionAllocations.filter(a => a.lineId === context.lineReference);

  let totalCustomerRefundAmount = new Decimal(0);
  let totalPlatformSubventionReversal = new Decimal(0);
  let totalStoreBasisReversal = new Decimal(0);
  let budgetReversalAmount = new Decimal(0);

  for (const allocation of lineAllocations) {
    const refundResult = calculateRefundAllocations({
      lineTotal: context.lineTotal,
      platformFundedDiscount: allocation.platformFunding,
      storeFundedDiscount: allocation.storeFunding,
      refundProportion: context.refundProportion,
    });

    totalCustomerRefundAmount = totalCustomerRefundAmount.plus(refundResult.customerRefundAmount);
    totalPlatformSubventionReversal = totalPlatformSubventionReversal.plus(refundResult.platformSubventionReversal);
    totalStoreBasisReversal = totalStoreBasisReversal.plus(refundResult.storeBasisReversal);

    const promotionDiscountReversal = refundResult.platformSubventionReversal.plus(refundResult.storeBasisReversal);
    budgetReversalAmount = budgetReversalAmount.plus(promotionDiscountReversal);

    // Record budget movement REVERSE
    await recordBudgetMovement({
      budgetId: budget.id,
      campaignVersionId: redemption.campaignVersionId,
      movementType: 'REVERSE',
      amount: promotionDiscountReversal,
      operationId: context.operationId + '_' + ((allocation as any).id ?? (allocation as any).lineReference ?? "1"),
      requestHash: context.requestHash,
      storeOrderId: context.storeOrderId,
      redemptionId: context.redemptionId,
    }, tx);
  }

  if (lineAllocations.length === 0) {
    totalCustomerRefundAmount = context.lineTotal.times(context.refundProportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  }

  // Update redemption status
  const updatedStatus = budgetReversalAmount.greaterThanOrEqualTo(redemption.discountAmount)
    ? 'FULLY_REVERSED'
    : 'PARTIALLY_REVERSED';
  await tx.promotionRedemption.update({
    where: { id: redemption.id },
    data: { status: updatedStatus }
  });

  // Record operation receipt
  await tx.promotionOperation.create({
    data: {
      operationId: context.operationId,
      requestHash: context.requestHash,
      operationType: 'REVERSAL',
      resultReference: redemption.id,
    }
  });

  return {
    customerRefundAmount: totalCustomerRefundAmount,
    platformSubventionReversal: totalPlatformSubventionReversal,
    storeBasisReversal: totalStoreBasisReversal,
    budgetReversalAmount,
    restorationPolicy: 'NEVER_RESTORE',
    restored: false,
    operationId: context.operationId,
  };
}
