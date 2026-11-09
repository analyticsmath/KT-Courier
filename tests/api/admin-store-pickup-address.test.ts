import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const f = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), limit: vi.fn(), read: vi.fn(), save: vi.fn(), preflight: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: f.auth }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: f.origin }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: f.limit, RATE_LIMITS: { ADDRESS_MUTATION: {} } }));
vi.mock("@/lib/services/store-addresses.service", () => ({ getStorePickupAddressForStore: f.read, upsertStorePickupAddressForStore: f.save }));
vi.mock("@/lib/admin/store-pickup-preflight.service", () => ({ getStorePickupOperationalPreflight: f.preflight }));
import { GET, PATCH } from "@/app/api/admin/stores/[id]/pickup-address/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const ctx = { params: Promise.resolve({ id: "store-1" }) };
const body = { line1: "10 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng", postalCode: "2196", country: "South Africa", latitude: -26.1, longitude: 28.05, placeId: "valid-place-123" };
const request = (payload: unknown = body) => new NextRequest("http://localhost/api/admin/stores/store-1/pickup-address", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

beforeEach(() => {
  vi.resetAllMocks(); f.origin.mockResolvedValue(null); f.auth.mockResolvedValue({ user: { id: "admin-1" } });
  f.limit.mockResolvedValue({ ok: true }); f.read.mockResolvedValue({ store: { id: "store-1" } });
  f.save.mockResolvedValue({ id: "pickup-1" }); f.preflight.mockResolvedValue({ stage: "INCOMPLETE" });
});

describe("admin merchant pickup", () => {
  it("requires store-update permission before exposing a pickup", async () => {
    f.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const res = await GET(new NextRequest("http://localhost/api/admin/stores/store-1/pickup-address"), ctx);
    expect(res.status).toBe(403); expect(f.read).not.toHaveBeenCalled();
    expect(f.auth).toHaveBeenCalledWith(PERMISSIONS.STORES_UPDATE, expect.anything());
  });
  it("does not save when the actor lacks permission", async () => {
    f.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const res = await PATCH(request(), ctx);
    expect(res.status).toBe(403); expect(f.save).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  });
  it("does not save a cross-origin request", async () => {
    f.origin.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const res = await PATCH(request(), ctx);
    expect(res.status).toBe(403); expect(f.auth).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
  });
  it("rejects unconfirmed collection data", async () => {
    const res = await PATCH(request({ ...body, line2: "" }), ctx);
    expect(res.status).toBe(422); expect(f.save).not.toHaveBeenCalled();
  });
  it("saves the requested store under the admin actor and reports independent readiness", async () => {
    const res = await PATCH(request(), ctx);
    expect(res.status).toBe(200);
    expect(f.save).toHaveBeenCalledWith("store-1", "admin-1", expect.objectContaining(body));
    expect(await res.json()).toMatchObject({ pickupAddress: { id: "pickup-1" }, readiness: { stage: "INCOMPLETE" } });
  });
  it("does not turn a provider failure after a successful save into a claimed readiness", async () => {
    f.preflight.mockRejectedValue(new Error("unavailable"));
    const res = await PATCH(request(), ctx);
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ readiness: null });
  });
});
