import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { applyPromotionRefundAdjustment, type PromotionRefundContext, type PromotionRefundResult } from '@/lib/promotions/promotion-refund.service';
import { assertPromotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';
import { calculateRefundAllocations } from '@/lib/promotions/promotion-refund-policy';

describe('promotion-refund service', () => {
  it('denies new issuance but permits cleanup, which still requires a matching adjustment', async () => {
    const input: PromotionRefundContext = { refundId: "refund-1", storeOrderId: "store-order-1", lineReference: "line-1", refundProportion: new Prisma.Decimal(1), lineTotal: new Prisma.Decimal("1.00"), frozenPromotionAllocations: [], redemptionId: "redemption-1", operationId: "operation-1", requestHash: "hash-1" };
    const env = process.env as Record<string, string | undefined>;
    const prev = { NODE_ENV: env.NODE_ENV, KT_COMMERCE_ENABLED: env.KT_COMMERCE_ENABLED };
    try {
      env.NODE_ENV = 'production';
      env.KT_COMMERCE_ENABLED = 'false';
      expect(() => assertPromotionsProductionReady('RESERVATION')).toThrow(PromotionsProductionLockedError);
      for (const operation of ['RELEASE', 'REVERSAL', 'RECONCILIATION'] as const) expect(() => assertPromotionsProductionReady(operation)).not.toThrow();
      const tx = { $queryRaw: vi.fn().mockResolvedValue([]), marketplaceStoreOrderAdjustment: { findFirst: vi.fn().mockResolvedValue(null) } };
      await expect(applyPromotionRefundAdjustment(input, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('A matching approved store adjustment and refund are required.');
    } finally {
      for (const [key, value] of Object.entries(prev)) {
        if (value === undefined) delete env[key];
        else env[key] = value;
      }
    }
  });

  it('calculateRefundAllocations full refund', () => {
    const result = calculateRefundAllocations({
      lineTotal: new Prisma.Decimal('100.00'),
      platformFundedDiscount: new Prisma.Decimal('20.00'),
      storeFundedDiscount: new Prisma.Decimal('10.00'),
      refundProportion: new Prisma.Decimal('1.0'),
    });
    // Customer paid: 100 - 20 platform - 10 store = 70.
    expect(result.customerRefundAmount.toFixed(2)).toBe('70.00');
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
