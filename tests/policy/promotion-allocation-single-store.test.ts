import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { allocatePromotionDiscount } from '@/lib/promotions/promotion-allocation-policy';

describe('Promotion Allocation Single Store', () => {
  it('allocates R10 discount on 2 lines of R50 each', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [
        { lineId: 'L1', basisAmount: new Prisma.Decimal('50') },
        { lineId: 'L2', basisAmount: new Prisma.Decimal('50') }
      ],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].discountAmount).toEqual(new Prisma.Decimal('5'));
    expect(result[1].discountAmount).toEqual(new Prisma.Decimal('5'));
  });

  it('allocates R10 discount on 1 line of R100', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].discountAmount).toEqual(new Prisma.Decimal('10'));
  });

  it('allocates R0.01 discount on 3 equal lines (last gets remainder)', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('0.01'),
      lines: [
        { lineId: 'L1', basisAmount: new Prisma.Decimal('33.33') },
        { lineId: 'L2', basisAmount: new Prisma.Decimal('33.33') },
        { lineId: 'L3', basisAmount: new Prisma.Decimal('33.34') }
      ],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].discountAmount).toEqual(new Prisma.Decimal('0.00'));
    expect(result[1].discountAmount).toEqual(new Prisma.Decimal('0.00'));
    expect(result[2].discountAmount).toEqual(new Prisma.Decimal('0.01'));
  });

  it('allocates R0 for zero basis', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('0') }],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].discountAmount).toEqual(new Prisma.Decimal('0'));
  });

  it('allocates all to platform funding', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('10'));
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('0'));
  });
});
