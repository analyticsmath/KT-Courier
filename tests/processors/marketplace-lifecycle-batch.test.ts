import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ orders: vi.fn(), reservations: vi.fn(), initialize: vi.fn(), expire: vi.fn(), findActive: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { marketplaceStoreOrder: { findMany: mocks.orders }, marketplaceInventoryReservation: { findMany: mocks.reservations } } }));
vi.mock("@/lib/store-orders/store-order.service", () => ({ initializeMarketplaceStoreOrderOperations: mocks.initialize }));
vi.mock("@/lib/marketplace-checkout/inventory-reservation.service", () => ({ expireMarketplaceCheckoutReservation: mocks.expire }));
vi.mock("@/lib/marketplace-checkout/prisma-marketplace-reservation.repository", () => ({ createPrismaMarketplaceReservationRepository: () => ({ findActiveReservation: mocks.findActive }) }));
import { initializeMarketplaceOrdersBatch, expireMarketplaceReservationsBatch, uninitializedMarketplaceOrdersWhere } from "@/lib/marketplace-checkout/lifecycle-batch.service";
beforeEach(() => { vi.resetAllMocks(); mocks.orders.mockResolvedValue([{ publicReference: "store-order" }]); mocks.reservations.mockResolvedValue([{ id: "r1", publicReference: "res1", checkoutId: "c1" }]); mocks.findActive.mockResolvedValue({ id: "r1" }); mocks.expire.mockResolvedValue({ id: "r1", status: "EXPIRED" }); });
describe("automatic marketplace operational lifecycle", () => {
  it("only initializes verified paid canonical orders without an operational snapshot", async () => {
    const result = await initializeMarketplaceOrdersBatch({ mode: "APPLY", batchSize: 5 });
    expect(result.itemsCompleted).toBe(1);
    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ where: uninitializedMarketplaceOrdersWhere(), take: 5 }));
    expect(mocks.initialize).toHaveBeenCalledWith({ storeOrderReference: "store-order", operationId: "marketplace-initialize:store-order", requestHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
  it("keeps the original operation identity on retries, isolates failures, and never writes during dry run", async () => {
    await initializeMarketplaceOrdersBatch({ mode: "DRY_RUN", batchSize: 5 });
    expect(mocks.initialize).not.toHaveBeenCalled();
    mocks.orders.mockResolvedValue([{ publicReference: "bad" }, { publicReference: "good" }]);
    mocks.initialize.mockRejectedValueOnce(new Error("private error"));
    expect(await initializeMarketplaceOrdersBatch({ mode: "APPLY", batchSize: 5 })).toMatchObject({ itemsRetried: 1, itemsCompleted: 1 });
  });
  it("expires only the selected active reservation through payment-aware authority", async () => {
    expect(await expireMarketplaceReservationsBatch({ mode: "APPLY", batchSize: 5 })).toMatchObject({ itemsCompleted: 1 });
    expect(mocks.expire).toHaveBeenCalledWith(expect.any(Object), { id: "r1" }, expect.any(Date), "marketplace-expiry:res1");
    mocks.findActive.mockResolvedValue({ id: "newer-reservation" });
    mocks.expire.mockClear();
    expect(await expireMarketplaceReservationsBatch({ mode: "APPLY", batchSize: 5 })).toMatchObject({ itemsSkipped: 1 });
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it("treats a checkout that entered payment during expiry as skipped", async () => {
    mocks.expire.mockResolvedValue(null);
    expect(await expireMarketplaceReservationsBatch({ mode: "APPLY", batchSize: 5 })).toMatchObject({ itemsCompleted: 0, itemsSkipped: 1, itemsRetried: 0 });
  });
  it("does not mutate reservations in dry run", async () => {
    expect(await expireMarketplaceReservationsBatch({ mode: "DRY_RUN", batchSize: 5 })).toMatchObject({ itemsSkipped: 1 });
    expect(mocks.findActive).not.toHaveBeenCalled();
    expect(mocks.expire).not.toHaveBeenCalled();
  });
});
