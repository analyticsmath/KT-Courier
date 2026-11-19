import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  business: vi.fn(), user: vi.fn(), getAddress: vi.fn(), save: vi.fn(), preflight: vi.fn(),
}));
vi.mock("@/lib/client-platform/business-auth", () => ({
  requireBusinessApi: mocks.business,
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/services/store-addresses.service", () => ({
  getStorePickupAddress: mocks.getAddress,
  upsertStorePickupAddress: mocks.save,
}));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: vi.fn().mockResolvedValue({ ok: true }), RATE_LIMITS: { ADDRESS_MUTATION: {} } }));
vi.mock("@/lib/admin/store-pickup-preflight.service", () => ({
  getStorePickupOperationalPreflight: mocks.preflight,
}));

import { GET, PATCH, POST } from "@/app/api/store/pickup-address/route";

const store = { store: { id: "seller-123" }, pickupAddress: { line1: "12 Commerce St" } };
const report = {
  stage: "INCOMPLETE",
  blockers: ["PICKUP_SUBURB_MISSING", "PICKUP_MAP_LOCATION_MISSING"],
  outstandingChecks: ["CHECKOUT_NOT_TESTED"],
  routeVerified: false, checkoutCertified: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.business.mockResolvedValue(null);
  mocks.user.mockResolvedValue({ id: "store-owner-1", role: "STORE" });
  mocks.getAddress.mockResolvedValue(store);
  mocks.save.mockResolvedValue(store.pickupAddress);
  mocks.preflight.mockResolvedValue(report);
});

describe("merchant collection address visibility before an edit", () => {
  it("returns real outstanding pickup and route blockers from the signed-in seller's store", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pickupAddress: store.pickupAddress, readiness: report });
    expect(mocks.getAddress).toHaveBeenCalledWith("store-owner-1");
    expect(mocks.preflight).toHaveBeenCalledWith("seller-123");
  });

  it("authorizes and reads the explicitly selected store", async () => {
    const response = await GET(new NextRequest("http://localhost/api/store/pickup-address?storeId=seller-123"));
    expect(response.status).toBe(200);
    expect(mocks.business).toHaveBeenCalledWith("/api/store/pickup-address", "seller-123");
    expect(mocks.getAddress).toHaveBeenCalledWith("store-owner-1", "settings", "seller-123");
  });

  it("does not read a selected store when authorization denies it", async () => {
    mocks.business.mockResolvedValue(NextResponse.json({ error: "Not allowed" }, { status: 403 }));
    const response = await GET(new NextRequest("http://localhost/api/store/pickup-address?storeId=another-store"));
    expect(response.status).toBe(403);
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("saves the explicitly selected store after settings authorization", async () => {
    const body = { line1: "10 Main Road", suburb: "Sandton", city: "Johannesburg", province: "Gauteng", postalCode: "2196", country: "South Africa", latitude: -26.1, longitude: 28.05 };
    const request = new NextRequest("http://localhost/api/store/pickup-address?storeId=seller-123", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    expect(mocks.business).toHaveBeenCalledWith("/api/store/pickup-address", "seller-123");
    expect(mocks.save).toHaveBeenCalledWith("store-owner-1", expect.objectContaining(body), "seller-123");
    expect(mocks.getAddress).toHaveBeenCalledWith("store-owner-1", "settings", "seller-123");
  });

  it("does not save a selected store when authorization denies it", async () => {
    mocks.business.mockResolvedValue(NextResponse.json({ error: "Not allowed" }, { status: 403 }));
    const request = new NextRequest("http://localhost/api/store/pickup-address?storeId=another-store", { method: "PATCH" });
    expect((await PATCH(request)).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("preserves the selected store through the POST alias", async () => {
    const body = { line1: "10 Main Road", suburb: "Sandton", city: "Johannesburg", province: "Gauteng", postalCode: "2196", country: "South Africa", latitude: -26.1, longitude: 28.05 };
    const request = new NextRequest("http://localhost/api/store/pickup-address?storeId=seller-123", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await POST(request)).status).toBe(200);
    expect(mocks.business).toHaveBeenCalledOnce();
    expect(mocks.business).toHaveBeenCalledWith("/api/store/pickup-address", "seller-123");
    expect(mocks.save).toHaveBeenCalledWith("store-owner-1", expect.objectContaining(body), "seller-123");
  });

  it("does not manufacture checkout readiness when mapping/region checks fail", async () => {
    mocks.preflight.mockRejectedValue(new Error("geocoding unavailable"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ readiness: null });
  });

  it("refuses anonymous requests before touching merchant data", async () => {
    mocks.user.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("refuses roles without a business workspace before reading the saved pickup", async () => {
    mocks.business.mockResolvedValue(NextResponse.json({ error: "Not allowed" }, { status: 403 }));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.getAddress).not.toHaveBeenCalled();
  });

  it("returns not-found for stores missing from the scoped lookup", async () => {
    mocks.getAddress.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(mocks.preflight).not.toHaveBeenCalled();
  });
});
