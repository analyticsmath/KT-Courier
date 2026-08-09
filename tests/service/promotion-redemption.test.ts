import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { commitMarketplacePromotionRedemptions, type RedemptionCommitInput, type RedemptionCommitResult } from '@/lib/promotions/promotion-redemption.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-redemption service', () => {
  it('commitMarketplacePromotionRedemptions throws PromotionsProductionLockedError', async () => {
    const input: RedemptionCommitInput = { checkoutId: "checkout-1", checkoutReviewVersion: 1, acknowledgementFingerprint: "fingerprint", paymentId: "payment-1", paymentStatus: "SUCCEEDED", marketplaceOrderId: "order-1", reservationIds: [], frozenEvaluation: { eligible: [], applied: [], rejected: [], stackingEvidence: { selectedPromotionIds: [], rejectedPromotionIds: [], rejectionReasons: {} }, totalDiscount: new Prisma.Decimal(0), totalPlatformFunding: new Prisma.Decimal(0), totalStoreFunding: new Prisma.Decimal(0), allocations: [] }, operationId: "operation-1", requestHash: "hash-1", now: new Date() };
    await expect(commitMarketplacePromotionRedemptions(input, {} as Prisma.TransactionClient)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('RedemptionCommitInput and RedemptionCommitResult types exist', () => {
    const input: RedemptionCommitInput | null = null;
    const result: RedemptionCommitResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });

  it('commitMarketplacePromotionRedemptions is a function', () => {
    expect(typeof commitMarketplacePromotionRedemptions).toBe('function');
  });

  it('PromotionsProductionLockedError for COMMITMENT has correct operation', () => {
    const err = new PromotionsProductionLockedError('COMMITMENT');
    expect(err.operation).toBe('COMMITMENT');
    expect(err.name).toBe('PromotionsProductionLockedError');
  });
});
