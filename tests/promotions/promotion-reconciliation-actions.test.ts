import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), change: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
import { monitorPromotionReconciliation, resolvePromotionReconciliation } from "@/lib/promotions/admin-promotions.service";

beforeEach(() => {
  vi.clearAllMocks();
  mock.get.mockResolvedValue({ id: "case", publicReference: "case-ref", status: "OPEN" });
  mock.change.mockResolvedValue({ count: 1 }); mock.audit.mockResolvedValue({});
  mock.transaction.mockImplementation(async (work) => work({ promotionReconciliationCase: { findUnique: mock.get, updateMany: mock.change }, adminActivityLog: { create: mock.audit } }));
});

it("moves an open case to monitoring with an actor audit", async () => {
  await monitorPromotionReconciliation("case-ref", "admin");
  expect(mock.change).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "OPEN" }), data: expect.objectContaining({ status: "MONITORING" }) }));
  expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: "admin", entityId: "case" }) }));
});

it("requires a reason to resolve a case", async () => {
  await expect(resolvePromotionReconciliation("case-ref", { resolutionNotes: "" }, "admin")).rejects.toThrow();
  expect(mock.change).not.toHaveBeenCalled();
});

it("returns only the safe projection when monitoring is repeated", async () => {
  mock.get.mockResolvedValueOnce({ id: "case", status: "MONITORING", internalEvidence: "private" });
  mock.get.mockResolvedValueOnce({ publicReference: "case-ref", status: "MONITORING" });
  await expect(monitorPromotionReconciliation("case-ref", "admin")).resolves.toEqual({ publicReference: "case-ref", status: "MONITORING" });
  expect(mock.get).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.objectContaining({ publicReference: true }) }));
  expect(mock.audit).not.toHaveBeenCalled();
});

it("does not overwrite a case changed by another reviewer", async () => {
  mock.change.mockResolvedValueOnce({ count: 0 });
  await expect(resolvePromotionReconciliation("case-ref", { resolutionNotes: "Reviewed the source evidence" }, "admin")).rejects.toThrow();
  expect(mock.audit).not.toHaveBeenCalled();
});
