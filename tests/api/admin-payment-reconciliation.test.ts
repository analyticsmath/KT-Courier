import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-confirmation-query.service", () => ({ listPaymentReconciliation: mocks.list }));
import * as route from "@/app/api/admin/payment-reconciliation/route";
describe("admin payment reconciliation list API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });
  it("enforces permission including explicit DENY", async () => { mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 403 }) }); expect((await route.GET(new NextRequest("https://local/api/admin/payment-reconciliation"))).status).toBe(403); });
  it("supports bounded filters and pagination", async () => { expect((await route.GET(new NextRequest("https://local/api/admin/payment-reconciliation?page=2&status=OPEN&priority=HIGH"))).status).toBe(200); expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, status: "OPEN", priority: "HIGH" })); });
  it("has no mutation method", () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); });
});
