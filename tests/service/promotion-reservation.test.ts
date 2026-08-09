import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { reserveCheckoutPromotions, RESERVATION_TTL_MS, type ReservationInput, type ReservationEvidence } from '@/lib/promotions/promotion-reservation.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-reservation service', () => {
  it('reserveCheckoutPromotions throws PromotionsProductionLockedError', async () => {
    const input: ReservationInput = { checkoutId: "checkout-1", checkoutReviewVersion: 1, evaluationResult: { eligible: [], applied: [], rejected: [], stackingEvidence: { selectedPromotionIds: [], rejectedPromotionIds: [], rejectionReasons: {} }, totalDiscount: new Prisma.Decimal(0), totalPlatformFunding: new Prisma.Decimal(0), totalStoreFunding: new Prisma.Decimal(0), allocations: [] }, appliedPromotions: [], operationId: "operation-1", requestHash: "hash-1", now: new Date() };
    await expect(reserveCheckoutPromotions(input, {} as Prisma.TransactionClient)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('ReservationInput and ReservationEvidence types exist', () => {
    const input: ReservationInput | null = null;
    const evidence: ReservationEvidence | null = null;
    expect(input).toBeNull();
    expect(evidence).toBeNull();
  });

  it('RESERVATION_TTL_MS is 30 minutes', () => {
    expect(RESERVATION_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('reserveCheckoutPromotions is a function', () => {
    expect(typeof reserveCheckoutPromotions).toBe('function');
  });
});
