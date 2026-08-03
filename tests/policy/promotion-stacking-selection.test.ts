import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { evaluateStackingPolicy } from '@/lib/promotions/promotion-stacking-policy';

const promo = (id: string, category: 'SUBSCRIPTION_BENEFIT' | 'AUTOMATIC_MERCHANDISE' | 'COUPON' | 'DELIVERY_PROMO', discount: string) => ({
  id,
  category,
  scope: 'LINE' as const,
  calculatedDiscount: new Prisma.Decimal(discount),
});

describe('Promotion Stacking Selection', () => {
  it('selects 4 promotions across 4 categories', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'AUTOMATIC_MERCHANDISE', '10'),
      promo('2', 'DELIVERY_PROMO', '10'),
      promo('3', 'COUPON', '10'),
      promo('4', 'SUBSCRIPTION_BENEFIT', '10'),
    ]);
    expect(result.evidence.selectedPromotionIds).toHaveLength(4);
  });

  it('selects only highest from 3 in same category', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'AUTOMATIC_MERCHANDISE', '10'),
      promo('2', 'AUTOMATIC_MERCHANDISE', '30'),
      promo('3', 'AUTOMATIC_MERCHANDISE', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toEqual(['2']);
    expect(result.evidence.rejectedPromotionIds).toContain('1');
    expect(result.evidence.rejectedPromotionIds).toContain('3');
    expect(result.evidence.rejectedPromotionIds).toHaveLength(2);
  });

  it('tracks selected and rejected accurately in evidence', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'AUTOMATIC_MERCHANDISE', '10'),
      promo('2', 'AUTOMATIC_MERCHANDISE', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toEqual(['2']);
    expect(result.evidence.rejectedPromotionIds).toEqual(['1']);
  });
});
