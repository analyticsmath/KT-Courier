import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  actor: vi.fn(), upload: vi.fn(), event: vi.fn(),
  db: {
    user: { findUnique: vi.fn() }, store: { findMany: vi.fn() },
    storeEmployeeMembership: { findMany: vi.fn() },
    permission: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.actor }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: vi.fn() }));
vi.mock("@/lib/services/security-events.service", () => ({ recordSecurityEvent: mocks.event, SECURITY_EVENT_TYPES: { PERMISSION_DENIED: "PERMISSION_DENIED" } }));
vi.mock("@/lib/client-platform/catalog-image-upload", () => ({ uploadNormalizedStoreImage: mocks.upload }));
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { POST } from "@/app/api/store/catalog/media/normalized/route";

const store = { id: "own-store", slug: "owned", name: "Owned", status: "ACTIVE" };
const request = () => new NextRequest("http://localhost:3000/api/store/catalog/media/normalized", { method: "POST" });
function employee(permissions = ["products"]) {
  mocks.actor.mockResolvedValue({ id: "employee", role: "CUSTOMER", status: "ACTIVE" });
  mocks.db.user.findUnique.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE" });
  mocks.db.store.findMany.mockResolvedValue([]);
  mocks.db.storeEmployeeMembership.findMany.mockResolvedValue([{ store, permissions }]);
}
async function status(key: string = PERMISSIONS.CATALOG_MANAGE) {
  const result = await requireStoreCatalogPermission(key, request());
  return "response" in result ? result.response.status : 200;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ id: "owner", role: "STORE", status: "ACTIVE" });
  mocks.db.user.findUnique.mockResolvedValue({ role: "STORE", status: "ACTIVE" });
  mocks.db.store.findMany.mockResolvedValue([store]);
  mocks.db.storeEmployeeMembership.findMany.mockResolvedValue([]);
  mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [{ enabled: true }], userPermissions: [] });
  mocks.upload.mockResolvedValue(Response.json({ asset: { publicReference: "CMA-safe", status: "READY" } }, { status: 201 }));
});
describe("store catalog HTTP authority", () => {
  it("allows the canonical active owner and normalized upload only after both business and catalog checks", async () => {
    expect((await POST(request())).status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(NextRequest), "owner", store.id, ["PRODUCT_IMAGE", "VARIANT_IMAGE"]);
    expect(mocks.db.permission.findUnique).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ rolePermissions: { where: { role: "STORE", enabled: true }, take: 1 } }) }));
  });
  it("keeps an explicit DENY stronger than the enabled role grant", async () => {
    mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [{}], userPermissions: [{ effect: "DENY" }] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("fails closed when the permission definition/table is missing", async () => {
    mocks.db.permission.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each(["absent", "disabled"])("refuses a %s STORE default grant", async () => {
    mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [], userPermissions: [] });
    expect(await status()).toBe(403);
  });
  it("retains the CUSTOMER employee identity and delegates only product read/manage/submit", async () => {
    employee();
    for (const key of [PERMISSIONS.CATALOG_READ, PERMISSIONS.CATALOG_MANAGE, PERMISSIONS.CATALOG_SUBMIT]) expect(await status(key)).toBe(200);
    for (const key of [PERMISSIONS.CATALOG_PRICING_MANAGE, PERMISSIONS.CATALOG_INVENTORY_MANAGE, PERMISSIONS.CATALOG_IMPORTS_MANAGE, PERMISSIONS.FINANCE_STORE_EARNINGS_READ]) expect(await status(key)).toBe(403);
    expect((await POST(request())).status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(NextRequest), "employee", store.id, expect.any(Array));
  });
  it("permits a granular employee action only through an explicit user grant, with DENY still taking precedence", async () => {
    employee();
    mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [], userPermissions: [{ effect: "ALLOW" }] });
    expect(await status(PERMISSIONS.CATALOG_PRICING_MANAGE)).toBe(200);
    mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [{}], userPermissions: [{ effect: "DENY" }] });
    expect(await status()).toBe(403);
  });
  it("refuses an employee missing products even with a catalog ALLOW", async () => {
    employee(["orders"]);
    mocks.db.permission.findUnique.mockResolvedValue({ rolePermissions: [{}], userPermissions: [{ effect: "ALLOW" }] });
    expect((await POST(request())).status).toBe(403);
  });
  it.each(["DISABLED", "REMOVED"])("refuses a %s employee with no active membership", async () => {
    employee(); mocks.db.storeEmployeeMembership.findMany.mockResolvedValue([]);
    expect((await POST(request())).status).toBe(403);
  });
  it("refuses inactive stores and users", async () => {
    mocks.db.store.findMany.mockResolvedValue([{ ...store, status: "SUSPENDED" }]);
    expect(await status()).toBe(403);
    mocks.db.store.findMany.mockResolvedValue([store]);
    mocks.db.user.findUnique.mockResolvedValue({ role: "STORE", status: "SUSPENDED" });
    expect(await status()).toBe(403);
  });
  it("refuses an unrelated customer without a business", async () => {
    employee(); mocks.db.storeEmployeeMembership.findMany.mockResolvedValue([]);
    expect((await POST(request())).status).toBe(403);
  });
  it("refuses ambiguous tenants", async () => {
    employee(); mocks.db.storeEmployeeMembership.findMany.mockResolvedValue([{ store, permissions: ["products"] }, { store: { ...store, id: "foreign" }, permissions: ["products"] }]);
    expect(await status()).toBe(403);
  });
  it("returns 401 for anonymous callers without invoking upload", async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
