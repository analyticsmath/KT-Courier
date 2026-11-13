import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mock = vi.hoisted(() => ({ origin: vi.fn(), auth: vi.fn(), gate: vi.fn(), monitor: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.auth }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/admin-promotions.service", () => ({ monitorPromotionReconciliation: mock.monitor, resolvePromotionReconciliation: mock.resolve }));
import { POST as monitor } from "@/app/api/admin/promotion-reconciliation/[reference]/monitor/route";
import { POST as resolve } from "@/app/api/admin/promotion-reconciliation/[reference]/resolve/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
const context = { params: Promise.resolve({ reference: "case" }) };
const request = () => new NextRequest("https://local/api/admin/promotion-reconciliation/case/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolutionNotes: "Reviewed the evidence" }) });
beforeEach(() => { vi.clearAllMocks(); mock.origin.mockResolvedValue(null); mock.auth.mockResolvedValue({ user: { id: "admin" } }); mock.monitor.mockResolvedValue({ status: "MONITORING" }); mock.resolve.mockResolvedValue({ status: "RESOLVED" }); });

it("refuses a cross-origin action before authorization or mutation", async () => {
  mock.origin.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
  expect((await monitor(request(), context)).status).toBe(403);
  expect(mock.auth).not.toHaveBeenCalled(); expect(mock.monitor).not.toHaveBeenCalled();
});

it("binds a resolution to the authorized actor", async () => {
  expect((await resolve(request(), context)).status).toBe(200);
  expect(mock.auth).toHaveBeenCalledWith(PERMISSIONS.PROMOTIONS_RECONCILIATION_MANAGE, expect.anything());
  expect(mock.resolve).toHaveBeenCalledWith("case", { resolutionNotes: "Reviewed the evidence" }, "admin");
});
