import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady } from '@/lib/promotions/production-lock';
import { normalizePromotionCode, checkCodeBruteForceProtection } from '@/lib/promotions/promotion-code-policy';
import { evaluateEligibilityRule } from '@/lib/promotions/promotion-eligibility-policy';
import { calculateDiscountAmount } from '@/lib/promotions/promotion-discount-policy';

const guestContext = {
  userId: undefined as string | undefined,
  isGuest: true,
  priorCompletedOrdersCount: 0,
  hasActiveSubscription: false,
  deliveryRegion: 'JHB',
  deliveryServiceType: 'STANDARD',
  subtotal: new Prisma.Decimal('100.00'),
};

describe('promotion-customer API contract', () => {
  it('production lock blocks EVALUATION', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION')).toThrow();
  });

  it('normalizePromotionCode handles valid input', () => {
    expect(normalizePromotionCode(' VALID-1 ')).toBe('VALID1');
  });

  it('checkCodeBruteForceProtection blocks excessive attempts', () => {
    expect(() => checkCodeBruteForceProtection(6)).toThrow();
  });

  it('guest can use ALL_CUSTOMERS', () => {
    expect(evaluateEligibilityRule({ rule: 'ALL_CUSTOMERS' }, guestContext)).toBe(true);
  });

  it('guest cannot use AUTHENTICATED_CUSTOMERS', () => {
    expect(evaluateEligibilityRule({ rule: 'AUTHENTICATED_CUSTOMERS' }, guestContext)).toBe(false);
  });

  it('guest cannot use FIRST_MARKETPLACE_ORDER', () => {
    expect(evaluateEligibilityRule({ rule: 'FIRST_MARKETPLACE_ORDER' }, guestContext)).toBe(false);
  });

  it('guest cannot use SPECIFIC_CUSTOMER_ALLOWLIST', () => {
    expect(evaluateEligibilityRule({ rule: 'SPECIFIC_CUSTOMER_ALLOWLIST' }, guestContext)).toBe(false);
  });

  it('guest can use SERVICE_TYPE matching', () => {
    expect(evaluateEligibilityRule({ rule: 'SERVICE_TYPE', serviceType: 'STANDARD' }, guestContext)).toBe(true);
  });

  it('discount never exceeds basis', () => {
    const amount = calculateDiscountAmount({
      scope: 'LINE', type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('150.00'),
      basisAmount: new Prisma.Decimal('100.00'),
    });
    expect(amount.lessThanOrEqualTo(new Prisma.Decimal('100.00'))).toBe(true);
  });

  it('discount is non-negative', () => {
    const amount = calculateDiscountAmount({
      scope: 'LINE', type: 'PERCENTAGE',
      value: new Prisma.Decimal('1000'),
      basisAmount: new Prisma.Decimal('100.00'),
    });
    expect(amount.greaterThanOrEqualTo(0)).toBe(true);
  });
});
