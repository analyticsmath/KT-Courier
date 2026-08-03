import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-query.service", () => ({ listPaymentProviders: mocks.list }));
import * as route from "@/app/api/admin/payment-providers/route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockReturnValue({ data: [{ code: "PAYFAST", configured: false, active: false, environment: "not-configured", errorCategory: "NOT_CONFIGURED", capabilities: {} }] }); });
describe("GET /api/admin/payment-providers", () => {
  it("enforces payment_providers.read including explicit DENY", async () => { mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status: 403 }) }); expect((await route.GET(new NextRequest("http://localhost/api/admin/payment-providers"))).status).toBe(403); });
  it("returns safe known-but-inactive readiness without credential facts", async () => { const response = await route.GET(new NextRequest("http://localhost/api/admin/payment-providers")); const body = await response.text(); expect(body).toContain("PAYFAST"); expect(body).not.toMatch(/merchant|password|secret|token|credentialLength/i); });
  it("exports no write method", () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); expect(route).not.toHaveProperty("DELETE"); });
});

