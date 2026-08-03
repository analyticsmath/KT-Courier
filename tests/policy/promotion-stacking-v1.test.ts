import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { evaluateStackingPolicy } from '@/lib/promotions/promotion-stacking-policy';

const promo = (id: string, category: 'SUBSCRIPTION_BENEFIT' | 'AUTOMATIC_MERCHANDISE' | 'COUPON' | 'DELIVERY_PROMO', discount: string) => ({
  id,
  category,
  scope: 'LINE' as const,
  calculatedDiscount: new Prisma.Decimal(discount),
});

describe('Promotion Stacking v1', () => {
  it('selects single promotion', () => {
    const result = evaluateStackingPolicy([promo('1', 'AUTOMATIC_MERCHANDISE', '10')]);
    expect(result.evidence.selectedPromotionIds).toEqual(['1']);
  });

  it('selects higher value, rejects lower in same category', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'AUTOMATIC_MERCHANDISE', '10'),
      promo('2', 'AUTOMATIC_MERCHANDISE', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toEqual(['2']);
    expect(result.evidence.rejectedPromotionIds).toEqual(['1']);
  });

  it('selects both in different categories', () => {
    const result = evaluateStackingPolicy([
      promo('1', 'AUTOMATIC_MERCHANDISE', '10'),
      promo('2', 'DELIVERY_PROMO', '20'),
    ]);
    expect(result.evidence.selectedPromotionIds).toContain('1');
    expect(result.evidence.selectedPromotionIds).toContain('2');
  });

  it('returns empty result for empty list', () => {
    const result = evaluateStackingPolicy([]);
    expect(result.evidence.selectedPromotionIds).toEqual([]);
    expect(result.evidence.rejectedPromotionIds).toEqual([]);
  });
});
