import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  enforceOrigin: vi.fn(),
  rateLimit: vi.fn(),
  redeem: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.enforceOrigin }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkIpRateLimit: mocks.rateLimit,
  RATE_LIMITS: { ADDRESS_MUTATION: {} },
}));
vi.mock("@/lib/rewards/customer-loyalty-redemption.service", () => ({
  CustomerLoyaltyRedemptionError: class CustomerLoyaltyRedemptionError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
  redeemCustomerLoyaltyPoints: mocks.redeem,
}));

import { POST } from "@/app/api/account/loyalty/redeem/route";

const request = (body: unknown = { operationId: "loyalty-op-0001", points: "100" }) => new NextRequest(
  "https://ktcouriers.test/api/account/loyalty/redeem",
  { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://ktcouriers.test" }, body: JSON.stringify(body) },
);

describe("customer-only loyalty to wallet conversion API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "customer-a", role: "CUSTOMER", status: "ACTIVE" });
    mocks.enforceOrigin.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.redeem.mockResolvedValue({ status: "REDEEMED", walletCreditZar: "2.00", pointsRedeemed: "100" });
  });

  it("checks CSRF, customer role and account status before calling the money service", async () => {
    mocks.enforceOrigin.mockResolvedValueOnce(new Response("origin denied", { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    mocks.getCurrentUser.mockResolvedValueOnce({ id: "driver-a", role: "DRIVER", status: "ACTIVE" });
    expect((await POST(request())).status).toBe(403);
    mocks.getCurrentUser.mockResolvedValueOnce({ id: "customer-a", role: "CUSTOMER", status: "SUSPENDED" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("validates point strings, operation IDs and rate limits before any debit", async () => {
    for (const body of [
      { operationId: "short", points: "100" },
      { operationId: "loyalty-op-0001", points: "1.5" },
      { operationId: "loyalty-op-0001", points: "0" },
      { operationId: "loyalty-op-0001", points: 100 },
      { operationId: "loyalty-op-0001", points: "100", customerId: "someone-else" },
    ]) expect((await POST(request(body))).status).toBe(400);
    mocks.rateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 15 });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("only returns the authenticated customer's serializable wallet receipt", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.redeem).toHaveBeenCalledWith({
      userId: "customer-a", operationId: "loyalty-op-0001", points: "100",
    });
    expect(await response.json()).toMatchObject({
      status: "REDEEMED", walletCreditZar: "2.00", pointsRedeemed: "100",
    });
  });

  it("never exposes database internals when posting fails", async () => {
    mocks.redeem.mockRejectedValueOnce(new Error("internal bank coordinates"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("internal bank coordinates");
  });
});
