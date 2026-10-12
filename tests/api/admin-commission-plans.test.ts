import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), mutation: vi.fn(), update: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/commissions/admin-mutation-route", () => ({ prepareCommissionMutation: mocks.mutation }));
vi.mock("@/lib/services/commission-plan.service", () => ({ updateDraftCommissionPlan: mocks.update }));
vi.mock("@/lib/services/commission-plan-query.service", () => ({ getCommissionPlan: mocks.query }));
import { GET, PATCH } from "@/app/api/admin/commission-plans/[id]/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { CommissionError } from "@/lib/commissions/errors";
const id = "c" + "a".repeat(24);
const context = { params: Promise.resolve({ id }) };
const draft = { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", basisType: "ORDER_SUBTOTAL", effectiveFrom: "2026-10-07T00:00:00Z", calculationVersion: "disposable-test", rules: [{ ruleCode: "PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "FIXED_AMOUNT", fixedAmount: "1.00", priority: 1 }], operationId: "disposable-test-command", expectedVersion: 2 };
const request = () => new NextRequest(`https://kt.example/api/admin/commission-plans/${id}`, { method: "PATCH" });
async function edit() {
  const response = await PATCH(request(), context);
  if (!response) throw new Error("Commission mutation did not return a response.");
  return response;
}
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "authenticated-maker" } }); mocks.mutation.mockResolvedValue({ body: draft }); });
describe("admin commission draft API", () => {
  it.each([401, 403])("denies a forbidden actor before any query or mutation (%i)", async (status) => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status }) });
    expect((await GET(request(), context)).status).toBe(status);
    expect((await edit()).status).toBe(status);
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.mutation).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([403, 429, 413])("preserves origin, rate and body-limit rejection before draft writes (%i)", async (status) => {
    mocks.mutation.mockResolvedValue({ response: Response.json({ error: "Rejected" }, { status }) });
    expect((await edit()).status).toBe(status); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires an explicit concurrency version and rejects client-supplied actor/approval fields", async () => {
    const missing: Partial<typeof draft> = { ...draft }; delete missing.expectedVersion;
    for (const body of [missing, { ...draft, actorUserId: "forged" }, { ...draft, approvedByUserId: "forged" }]) {
      mocks.mutation.mockResolvedValue({ body }); expect((await edit()).status).toBe(422);
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("uses the authenticated maker with the exact manage permission and returns uncached results", async () => {
    mocks.update.mockResolvedValue({ id, status: "DRAFT", version: 3 });
    const response = await edit();
    expect(mocks.auth).toHaveBeenCalledWith(PERMISSIONS.COMMISSION_PLANS_MANAGE, expect.anything());
    expect(mocks.update).toHaveBeenCalledWith(id, { ...draft, actorUserId: "authenticated-maker" });
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("returns conflict on a stale version without exposing database details", async () => {
    mocks.update.mockRejectedValue(new CommissionError("COMMISSION_IDEMPOTENCY_CONFLICT", "Stale version"));
    expect((await edit()).status).toBe(409);
    mocks.update.mockRejectedValue(new Error("sensitive-internal-database-diagnostic"));
    const failed = await edit(); expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("sensitive-internal");
  });
  it("accepts a store settlement draft through the existing authenticated mutation boundary", async () => {
    const scoped = { ...draft, subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${id}` };
    mocks.mutation.mockResolvedValue({ body: scoped }); mocks.update.mockResolvedValue({ id, status: "DRAFT" });
    expect((await edit()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(id, { ...scoped, actorUserId: "authenticated-maker" });
  });
  it.each([
    { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: "GLOBAL:COURIER_ORDER" },
    { subjectType: "COURIER_ORDER", scopeKey: `STORE:${id}` },
    { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${id}`, basisType: "ORDER_TOTAL" },
    { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: "STORE:unknown" },
  ])("rejects mismatched subjects, scopes and delivery-inclusive bases %#", async (override) => {
    mocks.mutation.mockResolvedValue({ body: { ...draft, ...override } });
    expect((await edit()).status).toBe(422); expect(mocks.update).not.toHaveBeenCalled();
  });
});
