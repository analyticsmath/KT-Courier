import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  marketplaceStoreOrder: { groupBy: vi.fn() },
  marketplaceOrderLine: { groupBy: vi.fn() },
  paymentAttempt: { count: vi.fn() },
  store: { count: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: mocks.hasPermission }));
import { classifyLiveStoreOrder, getStoreOperationsSnapshot } from "@/lib/services/admin-store-operations.service";

const actor = { id: "admin", role: "ADMIN", status: "ACTIVE" } as const;
describe("admin store operations are rooted in canonical LIVE orders and verified money", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.marketplaceStoreOrder.groupBy
      .mockResolvedValueOnce([
        { status: "SETTLED", derivedStatus: "PREPARING", financialResolutionStatus: "UNCHANGED", _count: { _all: 4 } },
        { status: "SETTLED", derivedStatus: "DELIVERED", financialResolutionStatus: "REFUND_COMPLETED", _count: { _all: 1 } },
        { status: "CANCELLED", derivedStatus: "REJECTED_OR_CANCELLED", financialResolutionStatus: "UNCHANGED", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { storeId: "s1", _count: { _all: 3 }, _sum: { merchandiseSubtotal: new Prisma.Decimal("99.95"), modifierSubtotal: new Prisma.Decimal("1.05") } },
      ]);
    mocks.marketplaceOrderLine.groupBy.mockResolvedValue([
      { productReference: "item1", title: "Item One", _sum: { quantity: 9, lineTotal: new Prisma.Decimal("20.50") } },
    ]);
    mocks.paymentAttempt.count.mockResolvedValue(2);
    mocks.store.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(6);
    mocks.store.findMany.mockResolvedValue([{ id: "s1", name: "Approved store", slug: "approved" }]);
  });
  it("keeps payment attempts separate from live order counts, ranks paid merchandise exactly", async () => {
    const result = await getStoreOperationsSnapshot(actor as never, "7_DAYS", new Date("2026-11-08T12:00:00Z"));
    expect(result.counts).toMatchObject({ PACKING: 4, REFUNDED: 1, CANCELLED: 2, DELIVERED: 0 });
    expect(result.totalStoreOrders).toBe(7);
    expect(result.failedMarketplacePaymentAttempts).toBe(2);
    expect(result.paidTopStores[0]).toMatchObject({ name: "Approved store", merchandise: "101.00", paidStoreOrders: 3 });
    expect(result.paidTopItems[0]).toMatchObject({ units: 9, sales: "20.50" });
    const storeQuery = mocks.marketplaceStoreOrder.groupBy.mock.calls[0][0];
    expect(storeQuery.where.operationalScope).toBe("LIVE");
    const rankings = mocks.marketplaceStoreOrder.groupBy.mock.calls[1][0];
    expect(rankings.where.marketplaceOrder.payment.status).toBe("SUCCEEDED");
  });
  it("prevents reading commercial order reports without BOTH store and order permission", async () => {
    mocks.hasPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(getStoreOperationsSnapshot(actor as never, "TODAY")).rejects.toThrow(/permissions/);
    expect(mocks.marketplaceStoreOrder.groupBy).not.toHaveBeenCalled();
  });
  it("maps statuses using actual financial and fulfilment authority, not arbitrary labels", () => {
    expect(classifyLiveStoreOrder({ status: "SETTLED", derivedStatus: "DELIVERED", financialResolutionStatus: "REFUND_COMPLETED" })).toBe("REFUNDED");
    expect(classifyLiveStoreOrder({ status: "SETTLED", derivedStatus: "IN_TRANSIT", financialResolutionStatus: "UNCHANGED" })).toBe("OUT_FOR_DELIVERY");
    expect(classifyLiveStoreOrder({ status: "SETTLED", derivedStatus: "AWAITING_STORE_REVIEW", financialResolutionStatus: "UNCHANGED" })).toBe("WAITING_FOR_STORE");
  });
});
