import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mock = vi.hoisted(() => ({ adjustments: vi.fn(), redemptions: vi.fn(), line: vi.fn(), transaction: vi.fn(), apply: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { marketplaceStoreOrderAdjustment: { findMany: mock.adjustments }, promotionRedemption: { findMany: mock.redemptions }, marketplaceOrderLine: { findFirst: mock.line }, $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/promotion-refund.service", () => ({ applyPromotionRefundAdjustment: mock.apply }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
import { recoverPromotionReversals } from "@/lib/promotions/promotion-reversal-recovery";

beforeEach(() => {
  vi.resetAllMocks();
  mock.adjustments.mockResolvedValue([{ id: "a", refundId: "f", marketplaceStoreOrderId: "s", deliveryFeeAmount: new Prisma.Decimal(0), allocations: [{ allocationType: "SELLER_BASIS", marketplaceOrderLineId: "l", originalQuantity: 2, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1 }], storeOrder: { marketplaceOrderId: "o", checkoutStoreGroupId: "g" } }]);
  mock.redemptions.mockResolvedValue([{ id: "r", allocations: [{ storeGroupReference: "g", lineReference: "snapshot", allocationType: "MERCHANDISE" }] }]);
  mock.line.mockResolvedValue({ checkoutLineSnapshotId: "snapshot", quantity: 2, lineTotal: new Prisma.Decimal(100) });
  mock.transaction.mockImplementation(fn => fn({ marker: "transaction" }));
});

it("dry-runs a source-backed reversal without financial mutation", async () => {
  expect(await recoverPromotionReversals()).toMatchObject({ examined: 1, eligible: 1, completed: 0, failed: 0 });
  expect(mock.transaction).not.toHaveBeenCalled();
});

it("passes persisted refund and quantity evidence to the canonical authority inside a transaction", async () => {
  expect(await recoverPromotionReversals({ apply: true })).toMatchObject({ eligible: 1, completed: 1, failed: 0 });
  expect(mock.gate).toHaveBeenCalledWith("REVERSAL");
  expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ refundId: "f", storeOrderId: "s", redemptionId: "r", refundProportion: new Prisma.Decimal("0.5"), lineTotal: new Prisma.Decimal(100) }), { marker: "transaction" });
});

it("reports unsupported multi-line adjustments for review and never invents a reversal", async () => {
  const rows = await mock.adjustments();
  rows[0].allocations.push({ ...rows[0].allocations[0], marketplaceOrderLineId: "other" });
  expect(await recoverPromotionReversals({ apply: true })).toMatchObject({ review: 1, completed: 0 });
  expect(mock.transaction).not.toHaveBeenCalled();
});

it("recovers valid multi-line adjustments when each adjusted line has complete source evidence", async () => {
  mock.adjustments.mockResolvedValue([{
    id: "adj-multi",
    refundId: "refund-multi",
    marketplaceStoreOrderId: "store-order-1",
    deliveryFeeAmount: new Prisma.Decimal(0),
    refundAmount: new Prisma.Decimal("185.00"),
    refund: {
      status: "SUCCEEDED",
      completedAt: new Date(),
      paymentId: "pay-1",
      customerUserId: "cust-1",
      amount: new Prisma.Decimal("185.00"),
      completionLedgerJournal: { type: "REFUND_EXTERNAL_PAYOUT", totalDebits: new Prisma.Decimal("185.00"), totalCredits: new Prisma.Decimal("185.00") },
    },
    allocations: [
      { allocationType: "SELLER_BASIS", marketplaceOrderLineId: "line-1", originalQuantity: 3, resolvedQuantityBefore: 1, resolvedQuantityAfter: 2, amount: new Prisma.Decimal("98.00") },
      { allocationType: "SELLER_BASIS", marketplaceOrderLineId: "line-2", originalQuantity: 2, resolvedQuantityBefore: 0, resolvedQuantityAfter: 2, amount: new Prisma.Decimal("96.00") },
    ],
    storeOrder: { marketplaceOrderId: "order-1", checkoutStoreGroupId: "group-1", marketplaceOrder: { paymentId: "pay-1", customerUserId: "cust-1" } },
  }]);
  mock.redemptions.mockResolvedValue([{
    id: "redemption-1",
    allocations: [
      { storeGroupReference: "group-1", lineReference: "snap-1", allocationType: "MERCHANDISE", discountAmount: new Prisma.Decimal("15.00"), platformFunding: new Prisma.Decimal("9.00"), storeFunding: new Prisma.Decimal("6.00") },
      { storeGroupReference: "group-1", lineReference: "snap-2", allocationType: "MERCHANDISE", discountAmount: new Prisma.Decimal("10.00"), platformFunding: new Prisma.Decimal("6.00"), storeFunding: new Prisma.Decimal("4.00") },
    ],
  }]);
  mock.line.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === "line-1"
      ? { id: "line-1", checkoutLineSnapshotId: "snap-1", quantity: 3, lineTotal: new Prisma.Decimal("300.00"), effectiveUnitPrice: new Prisma.Decimal("100.00") }
      : { id: "line-2", checkoutLineSnapshotId: "snap-2", quantity: 2, lineTotal: new Prisma.Decimal("100.00"), effectiveUnitPrice: new Prisma.Decimal("50.00") }
  );
  const res = await recoverPromotionReversals({ apply: true });
  expect(res).toMatchObject({ examined: 1, eligible: 1, completed: 1, failed: 0, review: 0, reviewItems: [] });
  expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({
    refundId: "refund-multi",
    storeOrderId: "store-order-1",
    redemptionId: "redemption-1",
    lines: [
      { lineReference: "snap-1", refundProportion: new Prisma.Decimal(1).div(3), lineTotal: new Prisma.Decimal("300.00") },
      { lineReference: "snap-2", refundProportion: new Prisma.Decimal(1), lineTotal: new Prisma.Decimal("100.00") },
    ],
  }), { marker: "transaction" });
});

it("marks delivery-fee adjustments and mismatched refund journals for actionable manual review without mutating state", async () => {
  mock.adjustments.mockResolvedValue([
    {
      id: "adj-delivery",
      refundId: "ref-1",
      marketplaceStoreOrderId: "s",
      deliveryFeeAmount: new Prisma.Decimal("35.00"),
      allocations: [{ allocationType: "SELLER_BASIS", marketplaceOrderLineId: "l", originalQuantity: 1, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1 }],
      storeOrder: { marketplaceOrderId: "o", checkoutStoreGroupId: "g" },
    },
    {
      id: "adj-bad-journal",
      refundId: "ref-2",
      marketplaceStoreOrderId: "s",
      deliveryFeeAmount: new Prisma.Decimal(0),
      refundAmount: new Prisma.Decimal("90.00"),
      refund: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        paymentId: "pay-1",
        customerUserId: "cust-1",
        amount: new Prisma.Decimal("90.00"),
        completionLedgerJournal: { type: "REFUND_EXTERNAL_PAYOUT", totalDebits: new Prisma.Decimal("80.00"), totalCredits: new Prisma.Decimal("90.00") },
      },
      allocations: [{ allocationType: "SELLER_BASIS", marketplaceOrderLineId: "l", originalQuantity: 2, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1 }],
      storeOrder: { marketplaceOrderId: "o", checkoutStoreGroupId: "g", marketplaceOrder: { paymentId: "pay-1", customerUserId: "cust-1" } },
    },
  ]);
  const res = await recoverPromotionReversals({ apply: true });
  expect(res).toMatchObject({
    examined: 2,
    eligible: 0,
    completed: 0,
    failed: 0,
    review: 2,
    reviewItems: [
      { adjustmentId: "adj-delivery", refundId: "ref-1", reasonCode: "DELIVERY_FEE_ADJUSTMENT_REQUIRES_REVIEW" },
      { adjustmentId: "adj-bad-journal", refundId: "ref-2", reasonCode: "REFUND_JOURNAL_EVIDENCE_INVALID" },
    ],
  });
  expect(mock.transaction).not.toHaveBeenCalled();
});

it("reports a failed authority check instead of claiming a completed reversal", async () => {
  mock.apply.mockRejectedValue(new Error("source mismatch"));
  expect(await recoverPromotionReversals({ apply: true })).toMatchObject({ eligible: 1, completed: 0, failed: 1 });
});
