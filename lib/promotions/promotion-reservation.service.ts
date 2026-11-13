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
  // Recheck the source row INSIDE the locked financial transaction. A reviewed
  // checkout can change version, buyer, status or guest capability between
  // the outer API lookup and this reservation.
  const scopedCheckout = await tx.marketplaceCheckout.findUnique({
    where: { id: input.checkoutId },
    select: {
      reviewVersion: true, status: true,
      customerUserId: true, guestAccessTokenHash: true,
    },
  });
  if (!scopedCheckout
    || scopedCheckout.reviewVersion !== input.checkoutReviewVersion
    || !["READY_FOR_REVIEW", "RESERVED"].includes(scopedCheckout.status)
    || scopedCheckout.customerUserId !== (input.customerUserId ?? null)
    || scopedCheckout.guestAccessTokenHash !== (input.guestEvidenceReference ?? null)
    || (scopedCheckout.customerUserId === null && !scopedCheckout.guestAccessTokenHash)) {
    throw new Error("Promotion claim does not match the current authorized checkout review.");
  }

  // Preserve the checkout -> customer -> campaign lock order. Two concurrent
  // first-order reservations for the same customer cannot both win.
  if (input.customerUserId) await lockCustomer(input.customerUserId, tx);

  const campaignVersionIds = input.appliedPromotions.map(p => p.campaignVersionId);
  if (!input.operationId.trim() || !input.requestHash.trim()
    || new Set(campaignVersionIds).size !== campaignVersionIds.length
    || input.evaluationResult.applied.length !== input.appliedPromotions.length
    || input.appliedPromotions.some(applied => {
      const evaluated = input.evaluationResult.applied.find(
        candidate => candidate.campaignVersionId === applied.campaignVersionId,
      );
      return !evaluated
        || !evaluated.calculatedDiscount.equals(applied.calculatedDiscount)
        || !evaluated.platformFunding.equals(applied.platformFunding)
        || !evaluated.storeFunding.equals(applied.storeFunding);
    })) {
    throw new Error('Promotion reservation does not match evaluated checkout evidence.');
  }

  // A coupon cannot be assigned merely because a campaign has one or more
  // active code records. Bind it to the exact 256-bit HMAC that passed code
  // validation; an unbound coupon is NEVER a valid checkout discount.
  const couponClaims = input.appliedPromotions.filter(item => item.applicationMethod === "COUPON_CODE");
  if (couponClaims.length > 1
    || (couponClaims.length > 0 && !/^[a-f0-9]{64}$/.test(input.appliedCouponCode ?? ""))
    || (couponClaims.length === 0 && input.appliedCouponCode !== undefined)) {
    throw new Error("A single validated coupon HMAC is required for a coupon-funded checkout discount.");
  }

  // Replay is checked BEFORE first-order claims, otherwise the original
  // reservation blocks its own idempotent retry. The operation receipt owns
  // idempotency; one command may legitimately reserve multiple campaigns.
  const operation = await tx.promotionOperation.findUnique({
    where: { operationId: input.operationId },
  });
  const existingRecords = await tx.promotionReservation.findMany({
    where: { operationId: input.operationId },
    orderBy: { campaignVersionId: 'asc' },
  });
  if (operation || existingRecords.length > 0) {
    if (!operation || operation.operationType !== 'RESERVATION'
      || operation.requestHash !== input.requestHash
      || existingRecords.length !== campaignVersionIds.length
      || existingRecords.some(record =>
        record.requestHash !== input.requestHash
        || record.checkoutId !== input.checkoutId
        || record.checkoutReviewVersion !== input.checkoutReviewVersion
        || record.customerUserId !== (input.customerUserId ?? null)
        || !campaignVersionIds.includes(record.campaignVersionId)
        || record.status !== 'RESERVED'
        || record.expiresAt <= input.now
      )) {
      throw new Error('Conflict: Promotion reservation operation belongs to different, expired or changed checkout evidence.');
    }
    return {
      reservationIds: existingRecords.map(record => record.id),
      reservations: existingRecords.map(record => ({
        id: record.id,
        publicReference: record.publicReference,
        campaignVersionId: record.campaignVersionId,
        promotionCodeId: record.promotionCodeId,
        checkoutId: record.checkoutId,
        checkoutReviewVersion: record.checkoutReviewVersion,
        customerUserId: record.customerUserId,
        status: 'RESERVED' as const,
        reservedDiscountAmount: new Decimal(record.reservedDiscountAmount),
        reservedPlatformFunding: new Decimal(record.reservedPlatformFunding),
        reservedStoreFunding: new Decimal(record.reservedStoreFunding),
        expiresAt: record.expiresAt,
        operationId: record.operationId,
        requestHash: record.requestHash,
      })),
      frozenEvaluation: input.evaluationResult,
      operationId: input.operationId,
      expiresAt: existingRecords[0]?.expiresAt ?? new Date(input.now.getTime() + RESERVATION_TTL_MS),
    };
  }

  // Inspect *persisted campaign rules*, not the caller's applied list. The
  // previous comparison was true for every applied campaign and incorrectly
  // disabled all repeat-customer discounts.
  await lockCampaignVersions(campaignVersionIds, tx);
  const hasFirstOrderRule = campaignVersionIds.length > 0 && await tx.promotionCampaignVersion.count({
    where: {
      id: { in: campaignVersionIds },
      eligibility: { some: { rule: 'FIRST_MARKETPLACE_ORDER' } },
    },
  }) > 0;
  if (hasFirstOrderRule) {
    if (!input.customerUserId) throw new Error('First-order promotions require an authenticated customer.');
    const [paidPriorOrders, priorOfferUses, outstandingClaims] = await Promise.all([
      tx.marketplaceOrder.count({
        where: {
          customerUserId: input.customerUserId,
          status: 'CONFIRMED',
          payment: { status: 'SUCCEEDED', successLedgerJournalId: { not: null } },
        },
      }),
      tx.promotionRedemption.count({
        where: {
          customerUserId: input.customerUserId,
          campaignVersion: { eligibility: { some: { rule: 'FIRST_MARKETPLACE_ORDER' } } },
        },
      }),
      tx.promotionReservation.count({
        where: {
          customerUserId: input.customerUserId,
          status: 'RESERVED',
          expiresAt: { gt: input.now },
          campaignVersion: { eligibility: { some: { rule: 'FIRST_MARKETPLACE_ORDER' } } },
        },
      }),
    ]);
    if (paidPriorOrders || priorOfferUses || outstandingClaims) {
      throw new Error('Customer already has a paid marketplace order or a first-order promotion claim.');
    }
  }

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
    
    // A validated HMAC belongs to precisely one active, unexpired code.
    // Never attach the first arbitrary code from a campaign to a discount.
    const code = applied.applicationMethod === "COUPON_CODE"
      ? codes.find(c => c.campaignVersionId === applied.campaignVersionId
        && c.codeHmac === input.appliedCouponCode
        && c.status === "ACTIVE"
        && (!c.startsAt || c.startsAt <= input.now)
        && (!c.expiresAt || c.expiresAt > input.now)
        && (!c.restrictedCustomerUserId || c.restrictedCustomerUserId === input.customerUserId))
      : null;
    if (applied.applicationMethod === "COUPON_CODE" && !code) {
      throw new Error("The checkout coupon is not valid for this customer and current review.");
    }
    if (code) {
      // Codes have already been row-locked in stable order. Count committed
      // use plus OTHER live reservations, not just committed redemption:
      // otherwise two unpaid checkouts could each hold the final use.
      const [committed, outstanding] = await Promise.all([
        tx.promotionRedemption.count({
          where: { promotionCodeId: code.id, status: "COMMITTED" },
        }),
        tx.promotionReservation.count({
          where: { promotionCodeId: code.id, status: "RESERVED", expiresAt: { gt: input.now } },
        }),
      ]);
      if (code.maximumRedemptions !== null
        && code.maximumRedemptions !== undefined
        && committed + outstanding >= code.maximumRedemptions) {
        throw new Error("The coupon has reached its maximum allowed uses.");
      }
      if (code.maximumRedemptionsPerCustomer !== null
        && code.maximumRedemptionsPerCustomer !== undefined) {
        if (!input.customerUserId) {
          throw new Error("This limited coupon requires a verified customer.");
        }
        const [customerCommitted, customerOutstanding] = await Promise.all([
          tx.promotionRedemption.count({
            where: { promotionCodeId: code.id, customerUserId: input.customerUserId, status: "COMMITTED" },
          }),
          tx.promotionReservation.count({
            where: { promotionCodeId: code.id, customerUserId: input.customerUserId, status: "RESERVED", expiresAt: { gt: input.now } },
          }),
        ]);
        if (customerCommitted + customerOutstanding >= code.maximumRedemptionsPerCustomer) {
          throw new Error("The coupon has already been claimed by this customer.");
        }
      }
    }
    const budget = budgets.find(b => b.campaignVersionId === applied.campaignVersionId);
    if (!budget) {
      throw new Error(`Budget not found for campaign version ${applied.campaignVersionId}`);
    }

    const record: ReservationRecord = {
      id: reservationId,
      publicReference: cuid(),
      campaignVersionId: applied.campaignVersionId,
      promotionCodeId: code?.id ?? null,
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
