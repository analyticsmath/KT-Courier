import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-query.service", () => ({ getPaymentDetail: mocks.detail }));
import * as route from "@/app/api/admin/payments/[id]/route";
const request = new NextRequest("http://localhost/api/admin/payments/p");
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.detail.mockResolvedValue(null); });
describe("GET /api/admin/payments/[id]", () => {
  it("enforces permission before lookup", async () => { mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status: 403 }) }); expect((await route.GET(request, { params: Promise.resolve({ id: "p" }) })).status).toBe(403); expect(mocks.detail).not.toHaveBeenCalled(); });
  it("returns safe not found and a DTO without hashes/credentials", async () => { expect((await route.GET(request, { params: Promise.resolve({ id: "missing" }) })).status).toBe(404); mocks.detail.mockResolvedValue({ payment: { id: "p", amount: "1.00" }, attempts: [{ merchantReference: "safe", providerReference: "safe" }], history: [] }); const response = await route.GET(request, { params: Promise.resolve({ id: "p" }) }); const body = await response.text(); expect(response.status).toBe(200); expect(body).not.toMatch(/requestHash|creationRequestHash|secret|token|password/i); });
  it("exports no write method", () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PUT"); expect(route).not.toHaveProperty("DELETE"); });
});

