import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { evaluateStackingPolicy } from '@/lib/promotions/promotion-stacking-policy';

const promo = (id: string, category: 'SUBSCRIPTION_BENEFIT' | 'AUTOMATIC_MERCHANDISE' | 'COUPON' | 'DELIVERY_PROMO', discount: string) => ({
  id,
  category,
  scope: 'LINE' as const,
  calculatedDiscount: new Prisma.Decimal(discount),
});

describe('Promotion Subscription Compatibility', () => {
  it('selects both SUBSCRIPTION_BENEFIT and AUTOMATIC_MERCHANDISE', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'SUBSCRIPTION_BENEFIT', '10'),
      promo('2', 'AUTOMATIC_MERCHANDISE', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toContain('1');
    expect(result.evidence.selectedPromotionIds).toContain('2');
  });

  it('selects both SUBSCRIPTION_BENEFIT and DELIVERY_PROMO', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'SUBSCRIPTION_BENEFIT', '10'),
      promo('2', 'DELIVERY_PROMO', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toContain('1');
    expect(result.evidence.selectedPromotionIds).toContain('2');
  });

  it('selects only highest from two SUBSCRIPTION_BENEFITs', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'SUBSCRIPTION_BENEFIT', '10'),
      promo('2', 'SUBSCRIPTION_BENEFIT', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toEqual(['2']);
    expect(result.evidence.rejectedPromotionIds).toEqual(['1']);
  });
});
