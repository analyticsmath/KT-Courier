import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertCommissionPlanTransition } from "@/lib/commissions/commission-plan-state-machine";
const db = vi.hoisted(() => ({ store: { findUnique: vi.fn() }, commissionPlan: { aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, commissionRule: { deleteMany: vi.fn() }, adminActivityLog: { create: vi.fn() } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: typeof db) => Promise<unknown>) => work(db) } }));
import { createCommissionPlan, updateDraftCommissionPlan } from "@/lib/services/commission-plan.service";
const storeId = "c" + "a".repeat(24);
const draft = { subjectType: "MARKETPLACE_STORE_ORDER" as const, scopeKey: `STORE:${storeId}`, basisType: "ORDER_SUBTOTAL" as const, effectiveFrom: "2026-10-01T00:00:00Z", calculationVersion: "disposable-unit", actorUserId: "maker", operationId: "unit-commission-draft", rules: [{ ruleCode: "PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE" as const, beneficiaryType: "PLATFORM" as const, calculationMethod: "FIXED_AMOUNT" as const, fixedAmount: "1.00", priority: 1 }] };
beforeEach(() => {
  vi.resetAllMocks(); db.store.findUnique.mockResolvedValue({ id: storeId, status: "ACTIVE" });
  db.commissionPlan.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } }); db.commissionPlan.create.mockResolvedValue({ status: "DRAFT" });
});

describe("commission plan service contract", () => {
  it("keeps active plans out of mutable draft transitions", () => expect(() => assertCommissionPlanTransition("ACTIVE", "DRAFT")).toThrow());
  it("binds a store draft to an existing active store and preserves the review lifecycle", async () => {
    await createCommissionPlan(draft);
    expect(db.store.findUnique).toHaveBeenCalledWith({ where: { id: storeId }, select: { id: true, status: true } });
    expect(db.commissionPlan.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${storeId}`, status: "DRAFT", versionNumber: 3, createdByUserId: "maker" }) }));
    expect(db.commissionPlan.create.mock.calls[0][0].data).not.toHaveProperty("approvedByUserId");
  });
  it.each([null, { id: storeId, status: "PENDING" }, { id: storeId, status: "SUSPENDED" }])("rejects unknown or inactive stores before policy writes %#", async (store) => {
    db.store.findUnique.mockResolvedValue(store);
    await expect(createCommissionPlan(draft)).rejects.toMatchObject({ code: "COMMISSION_INVALID_PLAN" });
    expect(db.commissionPlan.create).not.toHaveBeenCalled();
  });
  it("rejects delivery-inclusive store basis even when the internal service is called directly", async () => {
    await expect(createCommissionPlan({ ...draft, basisType: "ORDER_TOTAL" })).rejects.toMatchObject({ code: "COMMISSION_INVALID_PLAN" });
    expect(db.store.findUnique).not.toHaveBeenCalled(); expect(db.commissionPlan.create).not.toHaveBeenCalled();
  });
  it("rejects a cross-store edit before removing or replacing existing rules", async () => {
    db.commissionPlan.findUnique.mockResolvedValue({ subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:c${"b".repeat(24)}`, status: "DRAFT", version: 1, createdByUserId: "maker", rules: [] });
    await expect(updateDraftCommissionPlan("plan", { ...draft, expectedVersion: 1 })).rejects.toMatchObject({ code: "COMMISSION_INVALID_PLAN" });
    expect(db.commissionRule.deleteMany).not.toHaveBeenCalled(); expect(db.commissionPlan.update).not.toHaveBeenCalled();
  });
});
