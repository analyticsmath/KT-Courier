import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/payment-confirmation-query.service", () => ({ getPaymentReconciliationDetail: mocks.detail }));
import * as route from "@/app/api/admin/payment-reconciliation/[id]/route";
const params = Promise.resolve({ id: "prc_abcdefghijklmnopqrstuvwx" });
describe("admin payment reconciliation detail API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.detail.mockResolvedValue({ publicReference: "prc_safe", reason: "UNKNOWN_OUTCOME", status: "OPEN", safeEvidence: { eventReference: "pwe_safe" } }); });
  it("returns safe evidence without financial mutation authority", async () => { const response = await route.GET(new NextRequest("https://local"), { params }); const body = await response.text(); expect(response.status).toBe(200); expect(body).not.toMatch(/rawBody|signature|passphrase|merchantKey|markSuccess/i); });
  it("is read-only and returns 404 for absent cases", async () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); mocks.detail.mockResolvedValueOnce(null); expect((await route.GET(new NextRequest("https://local"), { params })).status).toBe(404); });
});
