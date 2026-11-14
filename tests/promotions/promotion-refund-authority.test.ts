import { Prisma } from '@prisma/client';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ reverse: vi.fn() }));
vi.mock('@/lib/promotions/production-lock', () => ({ assertPromotionsProductionReady: vi.fn() }));
vi.mock('@/lib/promotions/promotion-adjustment-reversal', () => ({ reversePromotionBudgetForAdjustment: mock.reverse }));
import { applyPromotionRefundAdjustment, type PromotionRefundContext } from '@/lib/promotions/promotion-refund.service';

const decimal = (value: string) => new Prisma.Decimal(value);
const context: PromotionRefundContext = { refundId: 'refund', storeOrderId: 'store-order', lineReference: 'checkout-line', refundProportion: decimal('1'), lineTotal: decimal('100'), frozenPromotionAllocations: [], redemptionId: 'redemption', operationId: 'refund-operation', requestHash: 'hash' };
function fixture() {
  const allocation = { id: 'allocation', storeGroupReference: 'group', lineReference: 'checkout-line', allocationType: 'MERCHANDISE', platformFunding: decimal('6'), storeFunding: decimal('4') };
  const adjustment = { id: 'adjustment', refundId: 'refund', marketplaceStoreOrderId: 'store-order', status: 'COMPLETED', refundAmount: decimal('90'), deliveryFeeAmount: decimal('0'), allocations: [{ allocationType: 'SELLER_BASIS', marketplaceOrderLineId: 'order-line', originalQuantity: 1, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1, amount: decimal('96') }], storeOrder: { marketplaceOrderId: 'order', checkoutStoreGroupId: 'group', marketplaceOrder: { paymentId: 'payment', customerUserId: 'customer' } } };
  const refund = { status: 'SUCCEEDED', completedAt: new Date(), paymentId: 'payment', customerUserId: 'customer', amount: decimal('90'), completionLedgerJournal: { type: 'REFUND_WALLET_CREDIT', totalDebits: decimal('90'), totalCredits: decimal('90') } };
  const tx = { $queryRaw: vi.fn(), marketplaceStoreOrderAdjustment: { findFirst: vi.fn(async () => adjustment) }, paymentRefund: { findUnique: vi.fn(async () => refund) }, marketplaceOrderLine: { findFirst: vi.fn(async () => ({ id: 'order-line', quantity: 1, lineTotal: decimal('100'), effectiveUnitPrice: decimal('100') })) }, promotionRedemption: { findMany: vi.fn(async () => [{ id: 'redemption', redemptionReusePolicy: 'NEVER_RESTORE', allocations: [allocation] }]) }, promotionOperation: { findUnique: vi.fn(async () => null), create: vi.fn() } };
  return { tx, refund, adjustment };
}
beforeEach(() => { vi.clearAllMocks(); mock.reverse.mockResolvedValue(['movement']); });

it('uses completed payment and frozen store allocation evidence for reversal', async () => {
  const { tx } = fixture();
  const result = await applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient);
  expect(result.customerRefundAmount.toFixed(2)).toBe('90.00');
  expect(result.platformSubventionReversal.toFixed(2)).toBe('6.00');
  expect(result.storeBasisReversal.toFixed(2)).toBe('4.00');
  expect(mock.reverse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ adjustmentId: 'adjustment', marketplaceOrderId: 'order' }));
});

it('rejects a refund for another payment without reversing budget', async () => {
  const { tx, refund } = fixture(); refund.paymentId = 'foreign';
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('Verified refund payment evidence');
  expect(mock.reverse).not.toHaveBeenCalled();
});

it('rejects forged amounts even when caller-provided allocations claim otherwise', async () => {
  const { tx, refund } = fixture(); refund.amount = decimal('91'); refund.completionLedgerJournal.totalDebits = decimal('91'); refund.completionLedgerJournal.totalCredits = decimal('91');
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow();
  expect(mock.reverse).not.toHaveBeenCalled();
});
