import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-confirmation-query.service", () => ({ getPaymentWebhookDetail: mocks.detail }));
import * as route from "@/app/api/admin/payment-webhooks/[id]/route";
const params = Promise.resolve({ id: "pwe_abcdefghijklmnopqrstuvwx" });
describe("admin payment webhook detail API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.detail.mockResolvedValue({ publicReference: "pwe_safe", verification: { signature: true }, amount: "1.00" }); });
  it("returns safe detail without raw/signature/credential evidence", async () => { const response = await route.GET(new NextRequest("https://local/api/admin/payment-webhooks/pwe_abcdefghijklmnopqrstuvwx"), { params }); const body = await response.text(); expect(response.status).toBe(200); expect(body).not.toMatch(/rawBody|eventFingerprint|passphrase|merchantKey|signatureBase|credentialVersion/i); });
  it("returns safe auth denial and not found", async () => { mocks.auth.mockResolvedValueOnce({ response: NextResponse.json({}, { status: 403 }) }); expect((await route.GET(new NextRequest("https://local"), { params })).status).toBe(403); mocks.detail.mockResolvedValueOnce(null); expect((await route.GET(new NextRequest("https://local"), { params })).status).toBe(404); });
  it("is read-only", () => { expect(route).not.toHaveProperty("PATCH"); expect(route).not.toHaveProperty("DELETE"); });
});
