import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: mocks.scan } }));
vi.mock("@/lib/rewards/customer-parcel-loyalty.service", () => ({
  reconcileCompletedParcelLoyalty: mocks.reconcile,
}));
import { runCustomerParcelLoyaltyBatch } from "@/lib/rewards/customer-loyalty-batch";

describe("manual customer loyalty reconciliation processor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.scan.mockResolvedValue([
      { paymentId: "payment-1", customerUserId: "customer-a" },
      { paymentId: "payment-2", customerUserId: "customer-b" },
    ]);
  });

  it("bounds work and never scans under an invalid batch size", async () => {
    for (const batchSize of [0, -1, 201, 1.1, NaN, Infinity]) {
      await expect(runCustomerParcelLoyaltyBatch({ mode: "APPLY", batchSize })).rejects.toThrow(/batch size/i);
    }
    await expect(runCustomerParcelLoyaltyBatch({ mode: "INVALID" as never, batchSize: 10 }))
      .rejects.toThrow(/execution mode/i);
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it("does not award or alter points during DRY_RUN", async () => {
    const result = await runCustomerParcelLoyaltyBatch({ mode: "DRY_RUN", batchSize: 10 });
    expect(result).toMatchObject({
      itemsExamined: 2, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: 2,
      itemsRetried: 0, itemsReconciled: 0,
    });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(result.safeSummary).toContain("no changes made");
    const [query] = mocks.scan.mock.calls[0];
    expect(query.values).toContain(10);
  });

  it("only reports aggregate adjustments; one invalid source never blocks other customers", async () => {
    mocks.scan.mockResolvedValueOnce([
      { paymentId: "payment-1", customerUserId: "customer-a" },
      { paymentId: "payment-2", customerUserId: "customer-b" },
      { paymentId: "payment-3", customerUserId: "customer-c" },
      { paymentId: "payment-4", customerUserId: "customer-d" },
    ]);
    mocks.reconcile
      .mockResolvedValueOnce({ status: "AWARDED" })
      .mockResolvedValueOnce({ status: "REVERSED" })
      .mockResolvedValueOnce({ status: "REPLAYED" })
      .mockRejectedValueOnce(new Error("sensitive provider evidence"));
    const result = await runCustomerParcelLoyaltyBatch({ mode: "APPLY", batchSize: 25 });
    expect(result).toMatchObject({
      itemsExamined: 4, itemsClaimed: 4, itemsCompleted: 2,
      itemsSkipped: 1, itemsRetried: 1, itemsReconciled: 1,
    });
    expect(mocks.reconcile).toHaveBeenCalledTimes(4);
    expect(mocks.reconcile).toHaveBeenNthCalledWith(1, "customer-a", "payment-1");
    expect(result.safeSummary).not.toContain("sensitive provider evidence");
    expect(result.safeSummary).not.toContain("customer-a");
  });
});
