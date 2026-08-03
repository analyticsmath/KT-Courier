import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { applyPromotionRefundAdjustment, type PromotionRefundContext, type PromotionRefundResult } from '@/lib/promotions/promotion-refund.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';
import { calculateRefundAllocations } from '@/lib/promotions/promotion-refund-policy';

describe('promotion-refund service', () => {
  it('applyPromotionRefundAdjustment throws PromotionsProductionLockedError', async () => {
    await expect(applyPromotionRefundAdjustment({} as any, {} as any)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('calculateRefundAllocations full refund', () => {
    const result = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('1.0'),
    });
    // Customer paid: 100 - 20 = 80
    expect(result.customerRefundAmount.toFixed(2)).toBe('80.00');
    expect(result.platformSubventionReversal.toFixed(2)).toBe('20.00');
    expect(result.storeBasisReversal.toFixed(2)).toBe('10.00');
  });

  it('calculateRefundAllocations partial refund at 0.5', () => {
    const result = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('0'),
      refundProportion: new Prisma.Decimal('0.5'),
    });
    expect(result.customerRefundAmount.toFixed(2)).toBe('40.00');
    expect(result.platformSubventionReversal.toFixed(2)).toBe('10.00');
  });

  it('PromotionRefundContext and PromotionRefundResult types exist', () => {
    const ctx: PromotionRefundContext | null = null;
    const res: PromotionRefundResult | null = null;
    expect(ctx).toBeNull();
    expect(res).toBeNull();
  });
});
