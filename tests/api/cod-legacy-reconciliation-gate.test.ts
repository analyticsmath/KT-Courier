import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  origin: vi.fn(),
  auth: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkIpRateLimit: mocks.rate,
  RATE_LIMITS: { COD_RECONCILIATION: { name: "COD_RECONCILIATION" } },
}));
import { POST } from "@/app/api/admin/orders/[id]/cod/reconcile/route";

const request = () => new NextRequest("https://ktcouriers.test/api/admin/orders/order-1/cod/reconcile", {
  method: "POST", headers: { "content-type": "application/json", Origin: "https://ktcouriers.test" },
  body: JSON.stringify({ amount: "100.00", operationId: "legacy-reconcile-1", evidenceReference: "BANK:UNVERIFIED" }),
});

describe("legacy COD direct reconciliation cannot bypass verified deposit review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.origin.mockResolvedValue(null);
    mocks.auth.mockResolvedValue({ user: { id: "admin-1" }, response: null });
    mocks.rate.mockResolvedValue({ ok: true });
  });

  it("denies cross-origin, anonymous and unauthorized callers before giving migration details", async () => {
    mocks.origin.mockResolvedValueOnce(new Response("Origin refused", { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    mocks.auth.mockResolvedValueOnce({ response: new Response("Unauthorized", { status: 401 }) });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it("honors the COD-specific rate-limit policy", async () => {
    mocks.rate.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 45 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
  });

  it("returns 410 for even an authorized administrator, never posts money from unverified strings", async () => {
    const response = await POST(request());
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).error).toMatch(/verified driver cash deposit/i);
    expect(mocks.auth).toHaveBeenCalledWith("cod_operations.manage", expect.objectContaining({ request: expect.any(NextRequest) }));
    expect(mocks.rate).toHaveBeenCalledWith(expect.any(NextRequest),
      "cod-reconciliation:admin-1", expect.objectContaining({ name: "COD_RECONCILIATION" }));
  });
});
