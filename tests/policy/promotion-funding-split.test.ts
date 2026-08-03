import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { allocatePromotionDiscount } from '@/lib/promotions/promotion-allocation-policy';

describe('Promotion Funding Split', () => {
  it('allocates PLATFORM funding correctly', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('100'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'PLATFORM',
      platformShareBps: 10000
    });
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('100'));
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('0'));
  });

  it('allocates STORE funding correctly', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('100'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'STORE',
      platformShareBps: 0
    });
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('100'));
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('0'));
  });

  it('allocates SHARED at 7000 bps', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('100'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'SHARED',
      platformShareBps: 7000
    });
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('70'));
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('30'));
  });

  it('allocates SHARED at 3000 bps', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('100'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'SHARED',
      platformShareBps: 3000
    });
    expect(result[0].platformFunding).toEqual(new Prisma.Decimal('30'));
    expect(result[0].storeFunding).toEqual(new Prisma.Decimal('70'));
  });

  it('funding sum always equals discount amount', () => {
    const result = allocatePromotionDiscount({
      totalDiscountAmount: new Prisma.Decimal('100'),
      lines: [{ lineId: 'L1', basisAmount: new Prisma.Decimal('100') }],
      fundingType: 'SHARED',
      platformShareBps: 4500
    });
    const sum = result[0].platformFunding.add(result[0].storeFunding);
    expect(sum).toEqual(new Prisma.Decimal('100'));
  });
});
