import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-query.service", () => ({ listPayments: mocks.list }));
import * as route from "@/app/api/admin/payments/route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });
describe("GET /api/admin/payments", () => {
  it.each([[401, "unauthenticated"], [403, "wrong role"], [403, "missing permission"], [403, "explicit DENY"]])("returns %s for %s", async (status) => { mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status }) }); expect((await route.GET(new NextRequest("http://localhost/api/admin/payments"))).status).toBe(status); expect(mocks.list).not.toHaveBeenCalled(); });
  it("returns safe string-money pagination for authorized admins/SUPER_ADMIN", async () => { mocks.list.mockResolvedValue({ data: [{ id: "p", amount: "10.00", currency: "ZAR" }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }); const response = await route.GET(new NextRequest("http://localhost/api/admin/payments?status=CREATED")); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ data: [{ amount: "10.00" }] }); });
  it("rejects malformed filters/pagination and exports no write method", async () => { expect((await route.GET(new NextRequest("http://localhost/api/admin/payments?page=zero"))).status).toBe(400); expect((await route.GET(new NextRequest("http://localhost/api/admin/payments?status=PAID"))).status).toBe(400); expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); expect(route).not.toHaveProperty("DELETE"); });
});

