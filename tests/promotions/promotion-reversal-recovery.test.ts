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

it("reports a failed authority check instead of claiming a completed reversal", async () => {
  mock.apply.mockRejectedValue(new Error("source mismatch"));
  expect(await recoverPromotionReversals({ apply: true })).toMatchObject({ eligible: 1, completed: 0, failed: 1 });
});
