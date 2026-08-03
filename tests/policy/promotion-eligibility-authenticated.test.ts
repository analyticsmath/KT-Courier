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

describe('Promotion Eligibility Authenticated', () => {
  it('returns true for ALL_CUSTOMERS with guest', () => {
    expect(evaluateEligibilityRule({ rule: 'ALL_CUSTOMERS' }, { ...baseContext, isGuest: true })).toBe(true);
  });

  it('returns true for AUTHENTICATED_CUSTOMERS with userId', () => {
    expect(evaluateEligibilityRule({ rule: 'AUTHENTICATED_CUSTOMERS' }, { ...baseContext, isGuest: false, userId: 'U1' })).toBe(true);
  });

  it('returns false for AUTHENTICATED_CUSTOMERS with guest', () => {
    expect(evaluateEligibilityRule({ rule: 'AUTHENTICATED_CUSTOMERS' }, { ...baseContext, isGuest: true, userId: undefined })).toBe(false);
  });

  it('returns true for ACTIVE_SUBSCRIPTION_REQUIRED with subscription', () => {
    expect(evaluateEligibilityRule({ rule: 'ACTIVE_SUBSCRIPTION_REQUIRED' }, { ...baseContext, isGuest: false, userId: 'U1', hasActiveSubscription: true })).toBe(true);
  });

  it('returns false for ACTIVE_SUBSCRIPTION_REQUIRED without subscription', () => {
    expect(evaluateEligibilityRule({ rule: 'ACTIVE_SUBSCRIPTION_REQUIRED' }, { ...baseContext, isGuest: false, userId: 'U1', hasActiveSubscription: false })).toBe(false);
  });
});
