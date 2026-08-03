import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateDiscountAmount } from '@/lib/promotions/promotion-discount-policy';

describe('Promotion Discount Fixed', () => {
  it('calculates Fixed R25.00 on R100.00 basis', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('25.00'),
      basisAmount: new Prisma.Decimal('100.00')
    });
    expect(result).toEqual(new Prisma.Decimal('25.00'));
  });

  it('caps at basis when Fixed is R150.00 on R100.00 basis', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('150.00'),
      basisAmount: new Prisma.Decimal('100.00')
    });
    expect(result).toEqual(new Prisma.Decimal('100.00'));
  });

  it('throws when Fixed is R0', () => {
    expect(() => calculateDiscountAmount({
      scope: 'LINE',
      type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('0'),
      basisAmount: new Prisma.Decimal('100.00')
    })).toThrow();
  });

  it('returns R0.00 for negative basis', () => {
    const result = calculateDiscountAmount({
      scope: 'LINE',
      type: 'FIXED_AMOUNT',
      value: new Prisma.Decimal('25.00'),
      basisAmount: new Prisma.Decimal('-10.00')
    });
    expect(result).toEqual(new Prisma.Decimal('0.00'));
  });
});
