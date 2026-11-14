import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ origin: vi.fn(), auth: vi.fn(), gate: vi.fn(), create: vi.fn(), update: vi.fn(), submit: vi.fn(), approve: vi.fn(), reject: vi.fn(), budget: vi.fn(), codes: vi.fn() }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.auth }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/admin-promotions.service", () => ({ createPlatformCampaign: mock.create, updateAdminCampaign: mock.update, submitAdminCampaign: mock.submit, approveAdminCampaign: mock.approve, rejectAdminCampaign: mock.reject, increaseAdminCampaignBudget: mock.budget, generateCodeBatch: mock.codes }));
vi.mock("@/lib/client-platform/promotion-authoring.service", () => ({ listAdminPromotionRecords: vi.fn(), getAdminPromotionRecord: vi.fn() }));
import { POST as create } from "@/app/api/admin/promotions/route";
import { PATCH as update } from "@/app/api/admin/promotions/[reference]/route";
import { POST as submit } from "@/app/api/admin/promotions/[reference]/submit/route";
import { POST as approve } from "@/app/api/admin/promotions/[reference]/approve/route";
import { POST as reject } from "@/app/api/admin/promotions/[reference]/reject/route";
import { POST as budget } from "@/app/api/admin/promotions/[reference]/increase-budget/route";
import { POST as codes } from "@/app/api/admin/promotions/[reference]/generate-code-batch/route";

const context = { params: Promise.resolve({ reference: "campaign" }) };
const request = (method = "POST") => new NextRequest("https://local/api/admin/promotions/campaign", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: "10.00", count: 2, reason: "A valid review reason", operationId: "operation-123" }) });
beforeEach(() => { vi.clearAllMocks(); mock.origin.mockResolvedValue(null); mock.auth.mockResolvedValue({ user: { id: "admin" } }); });

it("rejects cross-origin authoring and financial actions before authorization", async () => {
  mock.origin.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  const responses = await Promise.all([create(request()), update(request("PATCH"), context), submit(request(), context), approve(request(), context), reject(request(), context), budget(request(), context), codes(request(), context)]);
  expect(responses.map(response => response.status)).toEqual(Array(7).fill(403));
  expect(mock.auth).not.toHaveBeenCalled();
  expect(mock.gate).not.toHaveBeenCalled();
});

it("binds budget and coupon operations to the authenticated administrator", async () => {
  mock.budget.mockResolvedValue({}); mock.codes.mockResolvedValue({});
  expect((await budget(request(), context)).status).toBe(200);
  expect(mock.budget).toHaveBeenCalledWith("campaign", "10.00", "admin", "operation-123");
  expect((await codes(request(), context)).status).toBe(200);
  expect(mock.codes).toHaveBeenCalledWith("campaign", 2, "admin", "operation-123");
});
