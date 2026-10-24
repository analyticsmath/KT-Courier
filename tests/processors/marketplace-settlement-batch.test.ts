import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), settle: vi.fn(), repository: {} }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { marketplaceStoreSettlementJob: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));
vi.mock("@/lib/marketplace-checkout/settlement.service", () => ({ settleMarketplaceStoreOrder: mocks.settle }));
vi.mock("@/lib/marketplace-checkout/prisma-marketplace-settlement.repository", () => ({ createPrismaMarketplaceSettlementRepository: () => mocks.repository }));
import { runMarketplaceSettlementBatch, dueMarketplaceSettlementJobsWhere } from "@/lib/marketplace-checkout/settlement-batch.service";
const jobs = [{ id: "j1", operationId: "immutable-op1", marketplaceStoreOrder: { publicReference: "so1" } }, { id: "j2", operationId: "immutable-op2", marketplaceStoreOrder: { publicReference: "so2" } }];
beforeEach(() => { vi.resetAllMocks(); mocks.findMany.mockResolvedValue(jobs); mocks.settle.mockResolvedValue({ replayed: false }); });
describe("automatic marketplace settlements", () => {
  it("inspects only due bounded jobs and never settles in dry run", async () => {
    expect(await runMarketplaceSettlementBatch({ mode: "DRY_RUN", batchSize: 25 })).toMatchObject({ itemsExamined: 2, itemsCompleted: 0, itemsSkipped: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: dueMarketplaceSettlementJobsWhere(expect.any(Date)), take: 25 }));
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("keeps unfunded or canceled cash orders out of the automatic settlement queue", () => {
    expect(dueMarketplaceSettlementJobsWhere().marketplaceStoreOrder).toEqual({
      operationalScope: "LIVE",
      acceptanceStatus: { notIn: ["REJECTED", "TIMED_OUT"] }, preparationStatus: { not: "ABORTED" },
      OR: [{ marketplaceOrder: { cashRequired: 0 } }, { deliveryBridge: { courierOrder: { cashOnDelivery: { status: "RECONCILED", remittanceDiscrepancy: 0 } } } }],
    });
  });
  it("uses each durable job operation ID, including on replay", async () => {
    await runMarketplaceSettlementBatch({ mode: "APPLY", batchSize: 25 });
    await runMarketplaceSettlementBatch({ mode: "APPLY", batchSize: 25 });
    expect(mocks.settle).toHaveBeenNthCalledWith(1, { marketplaceStoreOrderReference: "so1", operationId: "immutable-op1" }, mocks.repository);
    expect(mocks.settle).toHaveBeenNthCalledWith(3, { marketplaceStoreOrderReference: "so1", operationId: "immutable-op1" }, mocks.repository);
  });
  it("continues after a durably scheduled retry or reconciliation", async () => {
    mocks.findMany.mockResolvedValue([...jobs, { id: "j3", operationId: "op3", marketplaceStoreOrder: { publicReference: "so3" } }]);
    mocks.settle.mockRejectedValueOnce(new Error("private failure")).mockRejectedValueOnce(new Error("private payment"));
    mocks.findUnique.mockResolvedValueOnce({ status: "RETRYABLE" }).mockResolvedValueOnce({ status: "RECONCILIATION_REQUIRED" });
    const result = await runMarketplaceSettlementBatch({ mode: "APPLY", batchSize: 25 });
    expect(result).toMatchObject({ itemsCompleted: 1, itemsRetried: 1, itemsReconciled: 1 });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(mocks.settle).toHaveBeenCalledTimes(3);
  });
  it("surfaces failures without durable recovery rather than reporting a healthy run", async () => {
    mocks.settle.mockRejectedValueOnce(new Error("database unavailable"));
    mocks.findUnique.mockResolvedValue({ status: "PENDING" });
    await expect(runMarketplaceSettlementBatch({ mode: "APPLY", batchSize: 25 })).rejects.toThrow("database unavailable");
  });
});
