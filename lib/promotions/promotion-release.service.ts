import { assertPromotionsProductionReady } from './production-lock';
import { recordBudgetMovement } from './promotion-budget.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { lockBudgets, lockCampaignVersions } from './promotion-repositories';

export type ReleaseReason = 
  | 'CHECKOUT_REVIEW_REPLACEMENT'
  | 'STALE_ACKNOWLEDGEMENT'
  | 'COUPON_REMOVAL'
  | 'CHECKOUT_CANCELLATION'
  | 'RESERVATION_EXPIRY'
  | 'DEFINITE_PAYMENT_FAILURE'
  | 'ABANDONED_CHECKOUT';

export interface ReleaseInput {
  reservationIds: string[];
  reason: ReleaseReason;
  operationId: string;
  requestHash: string;
  now: Date;
}

export interface ReleaseResult {
  releasedIds: string[];
  alreadyReleasedIds: string[];
  skippedIds: string[];
  operationId: string;
}

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

export async function releaseCheckoutPromotions(input: ReleaseInput, tx: PrismaTransactionClient): Promise<ReleaseResult> {
  assertPromotionsProductionReady('RELEASE');

  if (input.reservationIds.length === 0) {
    return {
      releasedIds: [],
      alreadyReleasedIds: [],
      skippedIds: [],
      operationId: input.operationId
    };
  }

  // 1. Lock reservations in stable order
  const sortedResIds = [...new Set(input.reservationIds)].sort();
  await tx.$queryRaw`SELECT "id" FROM "PromotionReservation" WHERE "id" IN (${Prisma.join(sortedResIds)}) ORDER BY "id" ASC FOR UPDATE`;

  const reservations = await tx.promotionReservation.findMany({
    where: { id: { in: sortedResIds } }
  });

  const releasedIds: string[] = [];
  const alreadyReleasedIds: string[] = [];
  const skippedIds: string[] = [];

  // Identify those needing update and lock their campaigns and budgets
  const reservationsToRelease = reservations.filter(r => r.status !== 'RELEASED' && r.status !== 'EXPIRED');
  
  if (reservationsToRelease.length > 0) {
    const versionIds = reservationsToRelease.map(r => r.campaignVersionId);
    await lockCampaignVersions(versionIds, tx);

    const budgets = await tx.promotionBudget.findMany({
      where: { campaignVersionId: { in: versionIds } }
    });
    await lockBudgets(budgets.map(b => b.id), tx);

    for (const reservation of reservationsToRelease) {
      const budget = budgets.find(b => b.campaignVersionId === reservation.campaignVersionId);
      if (!budget) {
        throw new Error(`Budget not found for campaign version ${reservation.campaignVersionId}`);
      }

      await tx.promotionReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' }
      });

      await recordBudgetMovement({
        budgetId: budget.id,
        campaignVersionId: reservation.campaignVersionId,
        movementType: 'RELEASE',
        amount: new Decimal(reservation.reservedDiscountAmount),
        operationId: input.operationId + '_' + reservation.id,
        requestHash: input.requestHash,
        checkoutId: reservation.checkoutId,
      }, tx);

      releasedIds.push(reservation.id);
    }
  }

  for (const reservation of reservations) {
    if (reservation.status === 'RELEASED') {
      if (!releasedIds.includes(reservation.id)) {
        alreadyReleasedIds.push(reservation.id);
      }
    } else if (reservation.status === 'EXPIRED') {
      skippedIds.push(reservation.id);
    }
  }

  // Record operation receipt
  await tx.promotionOperation.create({
    data: {
      operationId: input.operationId,
      requestHash: input.requestHash,
      operationType: 'RELEASE',
      resultReference: releasedIds.join(','),
    }
  });

  return {
    releasedIds,
    alreadyReleasedIds,
    skippedIds,
    operationId: input.operationId,
  };
}
