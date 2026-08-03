import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateDiscountAmount } from '@/lib/promotions/promotion-discount-policy';

describe('Promotion Discount Percentage', () => {
  it('calculates 5000 bps on R200.00 to R100.00', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('5000'),
      basisAmount: new Prisma.Decimal('200.00')
    });
    expect(result).toEqual(new Prisma.Decimal('100.00'));
  });

  it('calculates 10000 bps on R50.00 to R50.00', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('10000'),
      basisAmount: new Prisma.Decimal('50.00')
    });
    expect(result).toEqual(new Prisma.Decimal('50.00'));
  });

  it('throws when value > 10000 bps', () => {
    expect(() => calculateDiscountAmount({
      scope: 'LINE',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('10001'),
      basisAmount: new Prisma.Decimal('100.00')
    })).toThrow();
  });

  it('throws when value is 0', () => {
    expect(() => calculateDiscountAmount({
      scope: 'LINE',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('0'),
      basisAmount: new Prisma.Decimal('100.00')
    })).toThrow();
  });

  it('caps discount at maximumDiscountAmount', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'PERCENTAGE',
      value: new Prisma.Decimal('1000'),
      basisAmount: new Prisma.Decimal('1000.00'),
      maximumDiscountAmount: new Prisma.Decimal('50.00')
    });
    expect(result).toEqual(new Prisma.Decimal('50.00'));
  });
});
