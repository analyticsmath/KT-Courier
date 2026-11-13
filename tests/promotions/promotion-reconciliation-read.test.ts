import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { promotionReconciliationCase: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));
import { getPromotionReconciliation, listPromotionReconciliations } from "@/lib/promotions/admin-promotions.service";

describe("promotion reconciliation reads", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("reads a bounded queue and filters only recognized statuses", async () => {
    const rows = [{ publicReference: "PRECON-1", status: "OPEN", safeSummary: "Needs review" }];
    mocks.findMany.mockResolvedValue(rows);
    expect(await listPromotionReconciliations({ status: "OPEN" })).toEqual(rows);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "OPEN" }, take: 100 }));
    await expect(listPromotionReconciliations({ status: "FORGED" })).rejects.toThrow();
  });
  it("looks up a real case and propagates database failures", async () => {
    mocks.findUnique.mockResolvedValue({ publicReference: "PRECON-1", status: "OPEN" });
    expect(await getPromotionReconciliation("PRECON-1")).toMatchObject({ publicReference: "PRECON-1" });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { publicReference: "PRECON-1" } }));
    mocks.findMany.mockRejectedValue(new Error("database unavailable"));
    await expect(listPromotionReconciliations()).rejects.toThrow("database unavailable");
  });
});
