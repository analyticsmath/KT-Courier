import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateRefundAllocations } from '@/lib/promotions/promotion-refund-policy';

describe('Promotion Seller Basis', () => {
  it('calculates customer paid R80 and full refund is R80', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('1.0')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('80.00');
  });

  it('calculates store basis reversal R10', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('1.0')
    });
    expect(allocations.storeBasisReversal.toFixed(2)).toBe('10.00');
  });
});
