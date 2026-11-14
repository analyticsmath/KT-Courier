import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ mutation: vi.fn(), rate: vi.fn(), owner: vi.fn(), gate: vi.fn(), apply: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/marketplace-checkout/api-policy", () => ({
  enforceMarketplaceMutation: mock.mutation, marketplaceOwner: mock.owner,
  marketplaceJson: (data: unknown, status = 200) => NextResponse.json(data, { status }),
  marketplaceError: () => NextResponse.json({}, { status: 503 }),
  readMarketplaceJson: async (request: Request) => request.json(),
  assertExactKeys: (body: Record<string, unknown>, keys: string[]) => { if (Object.keys(body).some(key => !keys.includes(key))) throw new Error("invalid"); },
  stringField: (body: Record<string, unknown>, key: string) => body[key],
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mock.rate }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
vi.mock("@/lib/promotions/cart-coupon.service", () => ({ applyCouponToCart: mock.apply, removeCouponFromCart: mock.remove }));
import { POST, DELETE } from "@/app/api/cart/coupon/route";

const request = (method = "POST") => new NextRequest("https://local/api/cart/coupon", { method, ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "TESTCODE" }) } : {}) });
beforeEach(() => { vi.clearAllMocks(); mock.mutation.mockResolvedValue(null); mock.rate.mockResolvedValue({ ok: true }); mock.owner.mockResolvedValue({ type: "CUSTOMER", userId: "customer" }); mock.apply.mockResolvedValue({ coupon: "TE****DE" }); mock.remove.mockResolvedValue({ coupon: null }); });

it("rejects cross-origin coupon changes before looking up the owner", async () => {
  mock.mutation.mockResolvedValue(NextResponse.json({}, { status: 403 }));
  expect((await POST(request())).status).toBe(403);
  expect((await DELETE(request("DELETE"))).status).toBe(403);
  expect(mock.owner).not.toHaveBeenCalled();
});

it("rate limits code attempts and binds valid changes to the owner", async () => {
  mock.rate.mockResolvedValueOnce({ ok: false });
  expect((await POST(request())).status).toBe(429);
  expect(mock.apply).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(mock.apply).toHaveBeenCalledWith({ type: "CUSTOMER", userId: "customer" }, "TESTCODE");
  expect((await DELETE(request("DELETE"))).status).toBe(200);
  expect(mock.remove).toHaveBeenCalledWith({ type: "CUSTOMER", userId: "customer" });
});
