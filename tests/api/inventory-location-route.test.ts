import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ business: vi.fn(), auth: vi.fn(), prepare: vi.fn(), create: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessApi: mocks.business }));
vi.mock("@/lib/catalog/catalog-auth", () => ({ requireStoreCatalogPermission: mocks.auth }));
vi.mock("@/lib/catalog/catalog-api-policy", async original => ({ ...await original<typeof import("@/lib/catalog/catalog-api-policy")>(), prepareCatalogMutation: mocks.prepare }));
vi.mock("@/lib/services/catalog-inventory-location.service", () => ({ createStoreInventoryLocation: mocks.create, listStoreInventoryLocations: mocks.list }));
import { GET, POST } from "@/app/api/store/catalog/inventory/locations/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const request = () => new NextRequest("http://localhost:3000/api/store/catalog/inventory/locations", { method: "POST" });
describe("stock location API authority", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.business.mockResolvedValue(null);
    mocks.auth.mockResolvedValue({ user: { id: "actor" }, store: { id: "owned-store" } });
    mocks.prepare.mockResolvedValue({ body: { name: "Stockroom", operationId: "test-operation-001" } });
    mocks.create.mockResolvedValue({ publicReference: "IL-test", name: "Stockroom" }); mocks.list.mockResolvedValue([]);
  });
  it.each([401, 403])("refuses unauthenticated or disallowed business access (%i)", async status => {
    mocks.business.mockResolvedValue(new Response(null, { status }));
    expect((await POST(request())).status).toBe(status); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("honors a current permission denial before reading input", async () => {
    mocks.auth.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await POST(request())).status).toBe(403); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([403, 429, 413])("preserves origin, rate or body denial (%i)", async status => {
    mocks.prepare.mockResolvedValue({ response: new Response(null, { status }) });
    expect((await POST(request())).status).toBe(status); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("derives ownership from authentication and rejects mass assignment", async () => {
    mocks.prepare.mockResolvedValue({ body: { name: "Stockroom", operationId: "test-operation-001", storeId: "foreign", isPrimary: true } });
    expect((await POST(request())).status).toBe(422); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses inventory manage authority and canonical store/actor with private responses", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.auth).toHaveBeenCalledWith(PERMISSIONS.CATALOG_INVENTORY_MANAGE, expect.any(NextRequest));
    expect(mocks.create).toHaveBeenCalledWith("owned-store", "actor", { name: "Stockroom", operationId: "test-operation-001" });
  });
  it("lists only the authenticated store with inventory read authority", async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith(PERMISSIONS.CATALOG_INVENTORY_READ, expect.any(NextRequest));
    expect(mocks.list).toHaveBeenCalledWith("owned-store");
  });
});
