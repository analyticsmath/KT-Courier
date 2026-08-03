import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import type { PromotionEvaluationResult, AppliedPromotion } from './promotion-evaluation.service';
import { recordBudgetMovement } from './promotion-budget.service';
import { lockCheckout, lockCustomer, lockCampaignVersions, lockCodes, lockBudgets } from './promotion-repositories';

export interface ReservationInput {
  checkoutId: string;
  checkoutReviewVersion: number;
  customerUserId?: string;
  guestEvidenceReference?: string;
  evaluationResult: PromotionEvaluationResult;
  appliedPromotions: AppliedPromotion[];
  operationId: string;
  requestHash: string;
  now: Date;
  appliedCouponCode?: string;
}

export interface ReservationEvidence {
  reservationIds: string[];
  reservations: ReservationRecord[];
  frozenEvaluation: PromotionEvaluationResult;
  operationId: string;
  expiresAt: Date;
}

export interface ReservationRecord {
  id: string;
  publicReference: string;
  campaignVersionId: string;
  promotionCodeId: string | null;
  checkoutId: string;
  checkoutReviewVersion: number;
  customerUserId: string | null;
  status: 'RESERVED';
  reservedDiscountAmount: Decimal;
  reservedPlatformFunding: Decimal;
  reservedStoreFunding: Decimal;
  expiresAt: Date;
  operationId: string;
  requestHash: string;
}

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

export const RESERVATION_TTL_MS = 30 * 60 * 1000;
const cuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export async function reserveCheckoutPromotions(input: ReservationInput, tx: PrismaTransactionClient): Promise<ReservationEvidence> {
  assertPromotionsProductionReady('RESERVATION');

  // 1. Lock Checkout
  await lockCheckout(input.checkoutId, tx);

  // 2. Lock Customer for first-order check (if customerUserId is set)
  if (input.customerUserId) {
    await lockCustomer(input.customerUserId, tx);
    
    // Check if any applied promotion has first order eligibility rule
    const hasFirstOrderRule = input.appliedPromotions.some(p => {
      return input.evaluationResult.applied.some(app => app.campaignVersionId === p.campaignVersionId);
    });

    if (hasFirstOrderRule) {
      // Query completed orders count for user in database
      const priorOrdersCount = await tx.marketplaceOrder.count({
        where: { customerUserId: input.customerUserId } // any order counts towards first-order completion check
      });

      // Query active first-order reservation claims
      const activeReservationsCount = await tx.promotionReservation.count({
        where: {
          customerUserId: input.customerUserId,
          status: 'RESERVED',
          campaignVersion: {
            eligibility: {
              some: {
                rule: 'FIRST_MARKETPLACE_ORDER'
              }
            }
          }
        }
      });

      if (priorOrdersCount > 0 || activeReservationsCount > 0) {
        throw new Error('Customer is ineligible for first-order promotion.');
      }
    }
  }

  // 3. Check for idempotency replay
  const existingRecords = await tx.promotionReservation.findMany({
    where: { operationId: input.operationId }
  });

  if (existingRecords.length > 0) {
    if (existingRecords[0].requestHash !== input.requestHash) {
      throw new Error(`Conflict: Replay of operation ${input.operationId} with different hash.`);
    }
    return {
      reservationIds: existingRecords.map((r) => r.id),
      reservations: existingRecords.map(r => ({
        id: r.id,
        publicReference: r.publicReference,
        campaignVersionId: r.campaignVersionId,
        promotionCodeId: r.promotionCodeId,
        checkoutId: r.checkoutId,
        checkoutReviewVersion: r.checkoutReviewVersion,
        customerUserId: r.customerUserId,
        status: 'RESERVED',
        reservedDiscountAmount: new Decimal(r.reservedDiscountAmount),
        reservedPlatformFunding: new Decimal(r.reservedPlatformFunding),
        reservedStoreFunding: new Decimal(r.reservedStoreFunding),
        expiresAt: r.expiresAt,
        operationId: r.operationId,
        requestHash: r.requestHash,
      })),
      frozenEvaluation: input.evaluationResult,
      operationId: input.operationId,
      expiresAt: existingRecords[0].expiresAt,
    };
  }

  // 4. Lock campaign versions in stable order
  const campaignVersionIds = input.appliedPromotions.map(p => p.campaignVersionId);
  await lockCampaignVersions(campaignVersionIds, tx);

  // 5. Look up and Lock codes in stable order
  const codes = await tx.promotionCode.findMany({
    where: {
      campaignVersionId: { in: campaignVersionIds }
    }
  });
  const codeIds = codes.map(c => c.id);
  await lockCodes(codeIds, tx);

  // 6. Look up and Lock budgets in stable order
  const budgets = await tx.promotionBudget.findMany({
    where: {
      campaignVersionId: { in: campaignVersionIds }
    }
  });
  const budgetIds = budgets.map(b => b.id);
  await lockBudgets(budgetIds, tx);

  const expiresAt = new Date(input.now.getTime() + RESERVATION_TTL_MS);
  const reservations: ReservationRecord[] = [];

  for (const applied of input.appliedPromotions) {
    const reservationId = cuid();
    
    // Find matching code if coupon
    const code = codes.find(c => c.campaignVersionId === applied.campaignVersionId);
    const budget = budgets.find(b => b.campaignVersionId === applied.campaignVersionId);
    if (!budget) {
      throw new Error(`Budget not found for campaign version ${applied.campaignVersionId}`);
    }

    const record: ReservationRecord = {
      id: reservationId,
      publicReference: cuid(),
      campaignVersionId: applied.campaignVersionId,
      promotionCodeId: applied.applicationMethod === 'COUPON_CODE' ? (code?.id || null) : null,
      checkoutId: input.checkoutId,
      checkoutReviewVersion: input.checkoutReviewVersion,
      customerUserId: input.customerUserId || null,
      status: 'RESERVED',
      reservedDiscountAmount: applied.calculatedDiscount,
      reservedPlatformFunding: applied.platformFunding,
      reservedStoreFunding: applied.storeFunding,
      expiresAt,
      operationId: input.operationId,
      requestHash: input.requestHash,
    };

    await tx.promotionReservation.create({
      data: {
        id: record.id,
        publicReference: record.publicReference,
        campaignVersionId: record.campaignVersionId,
        promotionCodeId: record.promotionCodeId,
        checkoutId: record.checkoutId,
        checkoutReviewVersion: record.checkoutReviewVersion,
        customerUserId: record.customerUserId,
        status: record.status,
        reservedDiscountAmount: record.reservedDiscountAmount,
        reservedPlatformFunding: record.reservedPlatformFunding,
        reservedStoreFunding: record.reservedStoreFunding,
        expiresAt: record.expiresAt,
        operationId: record.operationId,
        requestHash: record.requestHash,
      }
    });

    // Record BUDGET RESERVE movement
    await recordBudgetMovement({
      budgetId: budget.id,
      campaignVersionId: applied.campaignVersionId,
      movementType: 'RESERVE',
      amount: applied.calculatedDiscount,
      operationId: input.operationId + '_' + applied.campaignVersionId,
      requestHash: input.requestHash,
      checkoutId: input.checkoutId,
    }, tx);

    reservations.push(record);
  }

  // Record operation receipt
  await tx.promotionOperation.create({
    data: {
      operationId: input.operationId,
      requestHash: input.requestHash,
      operationType: 'RESERVATION',
      resultReference: reservations.map(r => r.id).join(','),
    }
  });

  return {
    reservationIds: reservations.map((r) => r.id),
    reservations,
    frozenEvaluation: input.evaluationResult,
    operationId: input.operationId,
    expiresAt,
  };
}
