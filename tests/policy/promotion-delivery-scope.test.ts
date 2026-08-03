import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateDiscountAmount } from '@/lib/promotions/promotion-discount-policy';

describe('Promotion Delivery Scope', () => {
  it('calculates PERCENTAGE for DELIVERY scope correctly', () => {
    const result = calculateDiscountAmount({
      scope: 'DELIVERY',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('5000'),
      basisAmount: new Prisma.Decimal('100.00')
    });
    expect(result).toEqual(new Prisma.Decimal('50.00'));
  });

  it('calculates FIXED_AMOUNT capped at delivery fee', () => {
    const result = calculateDiscountAmount({
      scope: 'DELIVERY',
      type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('150.00'),
      basisAmount: new Prisma.Decimal('100.00')
    });
    expect(result).toEqual(new Prisma.Decimal('100.00'));
  });

  it('returns R0 discount for zero delivery fee', () => {
    const result = calculateDiscountAmount({
      scope: 'DELIVERY',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('5000'),
      basisAmount: new Prisma.Decimal('0.00')
    });
    expect(result).toEqual(new Prisma.Decimal('0.00'));
  });
});
