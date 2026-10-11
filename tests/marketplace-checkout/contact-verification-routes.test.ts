import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), origin: vi.fn(), rate: vi.fn(), request: vi.fn(), verify: vi.fn(), status: vi.fn(), preference: vi.fn() }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mocks.rate, RATE_LIMITS: { MARKETPLACE_CHECKOUT_MUTATION: {} } }));
vi.mock("@/lib/marketplace-checkout/api-policy", async (original) => ({ ...await original<typeof import("@/lib/marketplace-checkout/api-policy")>(), marketplaceOwner: mocks.owner }));
vi.mock("@/lib/marketplace-checkout/guest-contact-verification.service", () => ({ requestGuestContactVerification: mocks.request, verifyGuestContact: mocks.verify, getGuestContactVerification: mocks.status, setGuestNotificationPreference: mocks.preference }));
import { GET, POST, PUT } from "@/app/api/checkout/[reference]/contact-verification/route";
import { PUT as preference } from "@/app/api/checkout/[reference]/contact-notifications/route";
const context = { params: Promise.resolve({ reference: "checkout-public" }) };
const request = (method: string, body: Record<string, unknown> = {}) => new NextRequest("http://localhost:3000/api/checkout/checkout-public/contact-verification", { method, headers: { "Content-Type": "application/json", origin: "http://localhost:3000" }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner.mockResolvedValue({ type: "GUEST", guestTokenHash: "owned" }); mocks.origin.mockResolvedValue(null); mocks.rate.mockResolvedValue({ ok: true });
  mocks.request.mockResolvedValue({ verificationReference: "public-challenge", verified: false }); mocks.verify.mockResolvedValue({ verified: true }); mocks.status.mockResolvedValue({ required: true, verified: false }); mocks.preference.mockResolvedValue({ emailUpdatesEnabled: false });
});
describe("guest verification and preference API boundaries", () => {
  it("checks origin and rate limits before any challenge or preference mutation", async () => {
    mocks.origin.mockResolvedValue(NextResponse.json({ error: "Invalid request origin" }, { status: 403 }));
    expect((await POST(request("POST", { operationId: "operation-123" }), context)).status).toBe(403);
    expect((await PUT(request("PUT", { verificationReference: "challenge", code: "123456" }), context)).status).toBe(403);
    expect((await preference(request("PUT", { enabled: false }), context)).status).toBe(403);
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.preference).not.toHaveBeenCalled();
    mocks.origin.mockResolvedValue(null); mocks.rate.mockResolvedValue({ ok: false });
    expect((await POST(request("POST", { operationId: "operation-123" }), context)).status).toBe(429);
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("requires checkout ownership even for verification status", async () => {
    mocks.owner.mockResolvedValue(null);
    expect((await GET(request("GET"), context)).status).toBe(401);
    expect((await POST(request("POST", { operationId: "operation-123" }), context)).status).toBe(401);
    expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects arbitrary destination and recipient fields without invoking the domain", async () => {
    expect((await POST(request("POST", { operationId: "operation-123", email: "spoofed@example.test" }), context)).status).toBe(422);
    expect((await PUT(request("PUT", { verificationReference: "challenge", code: "123456", customerUserId: "other" }), context)).status).toBe(422);
    expect((await preference(request("PUT", { enabled: "false" }), context)).status).toBe(422);
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.preference).not.toHaveBeenCalled();
  });
  it("passes only the scoped owner and challenge inputs, returning a private no-store DTO", async () => {
    const response = await POST(request("POST", { operationId: "operation-123" }), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ verificationReference: "public-challenge", verified: false });
    expect(mocks.owner).toHaveBeenCalledWith(expect.any(NextRequest), "checkout");
    expect(mocks.request).toHaveBeenCalledWith({ reference: "checkout-public", owner: { type: "GUEST", guestTokenHash: "owned" }, operationId: "operation-123" });
  });
});
