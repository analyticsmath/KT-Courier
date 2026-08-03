import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-confirmation-query.service", () => ({ listPaymentWebhooks: mocks.list }));
import * as route from "@/app/api/admin/payment-webhooks/route";
describe("admin payment webhook list API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });
  it.each([401, 403])("preserves auth/permission denial %s including explicit DENY", async (status) => { mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "Denied" }, { status }) }); expect((await route.GET(new NextRequest("https://local/api/admin/payment-webhooks"))).status).toBe(status); });
  it("accepts safe filters and pagination for an authorized admin/SUPER_ADMIN path", async () => { const response = await route.GET(new NextRequest("https://local/api/admin/payment-webhooks?page=2&environment=SANDBOX&processingStatus=APPLIED")); expect(response.status).toBe(200); expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, environment: "SANDBOX", processingStatus: "APPLIED" })); });
  it("rejects duplicate/unknown filters and exposes no mutation methods", async () => { expect((await route.GET(new NextRequest("https://local/api/admin/payment-webhooks?page=1&page=2"))).status).toBe(400); expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("DELETE"); });
});
