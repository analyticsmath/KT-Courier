import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), findStores: vi.fn(), get: vi.fn(), create: vi.fn(),
  rateLimit: vi.fn(), origin: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mock.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { store: { findMany: mock.findStores } } }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkIpRateLimit: mock.rateLimit, RATE_LIMITS: { ADDRESS_MUTATION: {} },
}));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/rewards/ordinary-referral.service", () => ({
  getOrdinaryReferralCode: mock.get, createOrdinaryReferralCode: mock.create,
  OrdinaryReferralError: class OrdinaryReferralError extends Error {},
}));

import { GET, POST } from "@/app/api/account/referrals/route";

const get = (url = "https://ktcouriers.com/api/account/referrals") => new NextRequest(url, { method: "GET" });
const post = (body: unknown) => new NextRequest("https://ktcouriers.com/api/account/referrals", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("ordinary referral account API enforces owner identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.getCurrentUser.mockResolvedValue({ id: "cust-1", status: "ACTIVE", role: "CUSTOMER" });
    mock.get.mockResolvedValue({ code: "KTR-1234567890ABCDEF12345678", referralsPending: 0, referralsRewarded: 0 });
    mock.create.mockResolvedValue({ code: "KTR-1234567890ABCDEF12345678", replayed: false });
    mock.origin.mockResolvedValue(null);
    mock.rateLimit.mockResolvedValue({ ok: true });
    mock.findStores.mockResolvedValue([]);
  });

  it("rejects unauthenticated and driver access before issuing any code", async () => {
    mock.getCurrentUser.mockResolvedValueOnce(null);
    expect((await GET(get())).status).toBe(401);
    mock.getCurrentUser.mockResolvedValueOnce({ id: "driver", role: "DRIVER", status: "ACTIVE" });
    expect((await POST(post({}))).status).toBe(403);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("only scopes the customer referral to their authenticated identity", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.get).toHaveBeenCalledWith({ userId: "cust-1", ownerType: "CUSTOMER" });
    const created = await POST(post({}));
    expect(created.status).toBe(200);
    expect(mock.create).toHaveBeenCalledWith({ userId: "cust-1", ownerType: "CUSTOMER" });
  });

  it("validates store ownership in the service rather than trusting the request field", async () => {
    mock.getCurrentUser.mockResolvedValue({ id: "seller", role: "STORE", status: "ACTIVE" });
    mock.findStores.mockResolvedValueOnce([{ id: "owned-store" }]);
    const implicit = await GET(get());
    expect(implicit.status).toBe(200);
    expect(mock.get).toHaveBeenCalledWith({ userId: "seller", ownerType: "STORE", storeId: "owned-store" });
    const created = await POST(post({ storeId: "other-store" }));
    expect(created.status).toBe(200);
    expect(mock.create).toHaveBeenCalledWith({ userId: "seller", ownerType: "STORE", storeId: "other-store" });
    mock.findStores.mockResolvedValueOnce([]);
    expect((await GET(get())).status).toBe(403);
  });

  it("lets a customer account request its store referral while leaving ownership validation to the service", async () => {
    expect((await GET(get("https://ktcouriers.com/api/account/referrals?storeId=owned-store"))).status).toBe(200);
    expect(mock.get).toHaveBeenCalledWith({ userId: "cust-1", ownerType: "STORE", storeId: "owned-store" });
    expect((await POST(post({ storeId: "owned-store" }))).status).toBe(200);
    expect(mock.create).toHaveBeenCalledWith({ userId: "cust-1", ownerType: "STORE", storeId: "owned-store" });
  });

  it("rejects malformed POST bodies, preserves same-origin and limits attempts", async () => {
    expect((await POST(post({ ownerType: "CUSTOMER", ownerId: "other" }))).status).toBe(400);
    mock.origin.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await POST(post({}))).status).toBe(403);
    mock.rateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    expect((await POST(post({}))).status).toBe(429);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("does not leak database errors or other-account details", async () => {
    mock.get.mockRejectedValueOnce(new Error("secret connection string"));
    const response = await GET(get());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret connection");
  });
});
