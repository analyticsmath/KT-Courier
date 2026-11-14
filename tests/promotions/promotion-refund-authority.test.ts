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
  const adjustment = { id: 'adjustment', adjustmentType: 'ITEM_REMOVAL', financialEvidence: { replacementCharge: '0.00' }, refundId: 'refund', marketplaceStoreOrderId: 'store-order', status: 'COMPLETED', refundAmount: decimal('90'), deliveryFeeAmount: decimal('0'), allocations: [{ allocationType: 'SELLER_BASIS', marketplaceOrderLineId: 'order-line', originalQuantity: 1, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1, amount: decimal('96') }], storeOrder: { marketplaceOrderId: 'order', checkoutStoreGroupId: 'group', marketplaceOrder: { paymentId: 'payment', customerUserId: 'customer' } } };
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

it('verifies the frozen replacement charge before recovering a discounted substitution refund', async () => {
  const { tx, refund, adjustment } = fixture();
  adjustment.adjustmentType = 'SUBSTITUTION'; adjustment.financialEvidence.replacementCharge = '50.00';
  adjustment.refundAmount = decimal('40'); adjustment.allocations[0].amount = decimal('46');
  refund.amount = decimal('40'); refund.completionLedgerJournal.totalDebits = decimal('40'); refund.completionLedgerJournal.totalCredits = decimal('40');
  const result = await applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient);
  expect(result.customerRefundAmount.toFixed(2)).toBe('40.00');
  adjustment.financialEvidence.replacementCharge = '91.00';
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('exceeds the amount paid');
});

it('reconciles a valid multi-line mixed-funding adjustment and cumulative partial quantities idempotently', async () => {
  const allocations = [
    { id: 'alloc-1', storeGroupReference: 'group', lineReference: 'checkout-line-1', allocationType: 'MERCHANDISE', discountAmount: decimal('15'), platformFunding: decimal('9'), storeFunding: decimal('6') },
    { id: 'alloc-2', storeGroupReference: 'group', lineReference: 'checkout-line-2', allocationType: 'MERCHANDISE', discountAmount: decimal('10'), platformFunding: decimal('6'), storeFunding: decimal('4') },
  ];
  // Line 1: qty 3, unit 100, total 300. Partial qty 1->2 (affected=1): platform=3, store=2, sellerBasisRefund=98, customerRefund=95
  // Line 2: qty 2, unit 50, total 100. Full qty 0->2 (affected=2): platform=6, store=4, sellerBasisRefund=96, customerRefund=90
  // Total customerRefund = 185
  const adjustment = {
    id: 'adj-multi',
    adjustmentType: 'QUANTITY_REDUCTION',
    financialEvidence: {},
    refundId: 'refund-multi',
    marketplaceStoreOrderId: 'store-order',
    status: 'COMPLETED',
    refundAmount: decimal('185'),
    deliveryFeeAmount: decimal('0'),
    allocations: [
      { allocationType: 'SELLER_BASIS', marketplaceOrderLineId: 'order-line-1', originalQuantity: 3, resolvedQuantityBefore: 1, resolvedQuantityAfter: 2, amount: decimal('98') },
      { allocationType: 'SELLER_BASIS', marketplaceOrderLineId: 'order-line-2', originalQuantity: 2, resolvedQuantityBefore: 0, resolvedQuantityAfter: 2, amount: decimal('96') },
    ],
    storeOrder: { marketplaceOrderId: 'order', checkoutStoreGroupId: 'group', marketplaceOrder: { paymentId: 'payment', customerUserId: 'customer' } },
  };
  const refund = {
    status: 'SUCCEEDED',
    completedAt: new Date(),
    paymentId: 'payment',
    customerUserId: 'customer',
    amount: decimal('185'),
    completionLedgerJournal: { type: 'REFUND_EXTERNAL_PAYOUT', totalDebits: decimal('185'), totalCredits: decimal('185') },
  };
  let storedOperation: { operationId: string; requestHash: string; operationType: string; resultReference: string } | null = null;
  const tx = {
    $queryRaw: vi.fn(),
    marketplaceStoreOrderAdjustment: { findFirst: vi.fn(async () => adjustment) },
    paymentRefund: { findUnique: vi.fn(async () => refund) },
    marketplaceOrderLine: {
      findFirst: vi.fn(async ({ where }: { where: { checkoutLineSnapshotId: string } }) =>
        where.checkoutLineSnapshotId === 'checkout-line-1'
          ? { id: 'order-line-1', checkoutLineSnapshotId: 'checkout-line-1', quantity: 3, lineTotal: decimal('300'), effectiveUnitPrice: decimal('100') }
          : where.checkoutLineSnapshotId === 'checkout-line-2'
            ? { id: 'order-line-2', checkoutLineSnapshotId: 'checkout-line-2', quantity: 2, lineTotal: decimal('100'), effectiveUnitPrice: decimal('50') }
            : null
      ),
    },
    promotionRedemption: { findMany: vi.fn(async () => [{ id: 'redemption', redemptionReusePolicy: 'NEVER_RESTORE', allocations }]) },
    promotionOperation: {
      findUnique: vi.fn(async () => storedOperation),
      create: vi.fn(async ({ data }) => { storedOperation = data; return data; }),
    },
  };
  const multiContext: PromotionRefundContext = {
    ...context,
    refundId: 'refund-multi',
    lineReference: 'checkout-line-1',
    refundProportion: new Prisma.Decimal(1).div(3),
    lineTotal: decimal('300'),
    lines: [
      { lineReference: 'checkout-line-1', refundProportion: new Prisma.Decimal(1).div(3), lineTotal: decimal('300') },
      { lineReference: 'checkout-line-2', refundProportion: decimal('1'), lineTotal: decimal('100') },
    ],
  };
  const first = await applyPromotionRefundAdjustment(multiContext, tx as unknown as Prisma.TransactionClient);
  expect(first.customerRefundAmount.toFixed(2)).toBe('185.00');
  expect(first.platformSubventionReversal.toFixed(2)).toBe('9.00');
  expect(first.storeBasisReversal.toFixed(2)).toBe('6.00');
  expect(first.budgetReversalAmount.toFixed(2)).toBe('15.00');
  expect(tx.promotionOperation.create).toHaveBeenCalledTimes(1);

  // Replay with identical operationId and requestHash does not create a second operation receipt
  const second = await applyPromotionRefundAdjustment(multiContext, tx as unknown as Prisma.TransactionClient);
  expect(second.customerRefundAmount.toFixed(2)).toBe('185.00');
  expect(tx.promotionOperation.create).toHaveBeenCalledTimes(1);

  // Conflicting replay hash is rejected
  await expect(applyPromotionRefundAdjustment({ ...multiContext, requestHash: 'different-hash' }, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('conflicts with its original evidence');
});

it('rejects mismatched customer, stale refund status, or multi-line refund sum discrepancy', async () => {
  const { tx, refund, adjustment } = fixture();
  refund.customerUserId = 'other-customer';
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('Verified refund payment evidence');

  refund.customerUserId = 'customer';
  refund.status = 'PROCESSING';
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('Verified refund payment evidence');

  refund.status = 'SUCCEEDED';
  adjustment.allocations[0].amount = decimal('95');
  await expect(applyPromotionRefundAdjustment(context, tx as unknown as Prisma.TransactionClient)).rejects.toThrow('Refund amount does not match');
  expect(mock.reverse).not.toHaveBeenCalled();
});
