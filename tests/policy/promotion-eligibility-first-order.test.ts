import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { evaluateEligibilityRule } from '@/lib/promotions/promotion-eligibility-policy';

const baseContext = {
  userId: undefined as string | undefined,
  isGuest: true,
  priorCompletedOrdersCount: 0,
  hasActiveSubscription: false,
  deliveryRegion: 'JHB',
  deliveryServiceType: 'STANDARD',
  subtotal: new Prisma.Decimal('100.00'),
};

describe('Promotion Eligibility First Order', () => {
  it('returns true for FIRST_MARKETPLACE_ORDER with 0 prior orders', () => {
    expect(evaluateEligibilityRule(
      { rule: 'FIRST_MARKETPLACE_ORDER' },
      { ...baseContext, isGuest: false, userId: 'U1', priorCompletedOrdersCount: 0 }
    )).toBe(true);
  });

  it('returns false for FIRST_MARKETPLACE_ORDER with 1 prior order', () => {
    expect(evaluateEligibilityRule(
      { rule: 'FIRST_MARKETPLACE_ORDER' },
      { ...baseContext, isGuest: false, userId: 'U1', priorCompletedOrdersCount: 1 }
    )).toBe(false);
  });

  it('returns false for FIRST_MARKETPLACE_ORDER with guest', () => {
    expect(evaluateEligibilityRule(
      { rule: 'FIRST_MARKETPLACE_ORDER' },
      { ...baseContext, isGuest: true, userId: undefined, priorCompletedOrdersCount: 0 }
    )).toBe(false);
  });
});
