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
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('70.00');
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
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('35.00');
    expect(allocations.storeBasisReversal.toFixed(2)).toBe('5.00');
    expect(allocations.platformSubventionReversal.toFixed(2)).toBe('10.00');
  });

  it('subtracts the store-funded discount from the amount paid', () => {
    const allocations = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('0.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('0.5')
    });
    expect(allocations.customerRefundAmount.toFixed(2)).toBe('45.00');
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
  it('rejects proportions above one and discounts greater than the original line', () => {
    expect(() => calculateRefundAllocations({ lineTotal: new Prisma.Decimal(100), platformFundedDiscount: new Prisma.Decimal(80), storeFundedDiscount: new Prisma.Decimal(30), refundProportion: new Prisma.Decimal(1) })).toThrow('Invalid');
    expect(() => calculateRefundAllocations({ lineTotal: new Prisma.Decimal(100), platformFundedDiscount: new Prisma.Decimal(0), storeFundedDiscount: new Prisma.Decimal(0), refundProportion: new Prisma.Decimal('1.01') })).toThrow('Invalid');
  });
});
