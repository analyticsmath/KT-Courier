import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateRefundAllocations } from '@/lib/promotions/promotion-refund-policy';

describe('Promotion Refund Allocation', () => {
  it('calculates exact reversal for full refund', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('1.0')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('80.00');
    expect(allocations.storeBasisReversal.toFixed(2)).toBe('10.00');
    expect(allocations.platformSubventionReversal.toFixed(2)).toBe('20.00');
  });

  it('calculates proportional amounts for partial refund', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('0.5')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('40.00');
    expect(allocations.storeBasisReversal.toFixed(2)).toBe('5.00');
    expect(allocations.platformSubventionReversal.toFixed(2)).toBe('10.00');
  });

  it('calculates customerRefundAmount = lineTotal * proportion when no platform funding', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('0.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('0.5')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('50.00');
  });

  it('calculates storeBasisReversal = 0 when no store funding', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('0.00'),
      refundProportion: new Prisma.Decimal('0.5')
    });
    expect(allocations.storeBasisReversal.toFixed(2)).toBe('0.00');
  });

  it('rounds residual cents using ROUND_HALF_EVEN', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('10.05'),
      platformFundedDiscount: new Prisma.Decimal('0.00'),
      storeFundedDiscount: new Prisma.Decimal('0.00'),
      refundProportion: new Prisma.Decimal('0.5')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('5.02');
  });
});
