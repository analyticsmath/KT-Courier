import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { allocatePromotionDiscount } from '@/lib/promotions/promotion-allocation-policy';

describe('Promotion Allocation Multi Store', () => {
  it('allocates R30 discount across 3 stores with different bases proportionally', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('30'),
      lines: [
        { lineId: 'L1', basisAmount: new Prisma.Decimal('100') },
        { lineId: 'L2', basisAmount: new Prisma.Decimal('200') },
        { lineId: 'L3', basisAmount: new Prisma.Decimal('300') }
      ],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].discountAmount).toEqual(new Prisma.Decimal('5'));
    expect(result[1].discountAmount).toEqual(new Prisma.Decimal('10'));
    expect(result[2].discountAmount).toEqual(new Prisma.Decimal('15'));
  });

  it('sum of all line discounts equals total discount exactly', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [
        { lineId: 'L1', basisAmount: new Prisma.Decimal('33.33') },
        { lineId: 'L2', basisAmount: new Prisma.Decimal('33.33') },
        { lineId: 'L3', basisAmount: new Prisma.Decimal('33.34') }
      ],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    const sum = result.reduce((acc, curr) => acc.add(curr.discountAmount), new Prisma.Decimal(0));
    expect(sum).toEqual(new Prisma.Decimal('10.00'));
  });

  it('allocates all to store funding when STORE funding', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'STORE',
      platformShareBps: 0
    });
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('10'));
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('0'));
  });

  it('splits 50/50 for SHARED funding at 5000 bps', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('10'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'SHARED',
      platformShareBps: 5000
    });
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('5'));
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('5'));
  });
});
