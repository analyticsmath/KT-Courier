import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogPngFixture } from "@/tests/catalog/catalog-media-test-fixtures";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const f = vi.hoisted(() => ({ find: vi.fn(), read: vi.fn(), cloudRead: vi.fn(), auth: vi.fn(), business: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogMediaAsset: { findUnique: f.find } } }));
vi.mock("@/lib/catalog/catalog-auth", () => ({ requireCatalogAdminPermission: f.auth, requireStoreCatalogPermission: f.auth }));
vi.mock("@/lib/catalog/media/catalog-media-storage-adapter", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/catalog/media/catalog-media-storage-adapter")>(),
  createProductionCatalogMediaStorageAdapter: () => ({ createReadTarget: f.read }),
}));
vi.mock("@/lib/catalog/media/cloudinary-catalog-media-storage", () => ({
  CLOUDINARY_CATALOG_STORAGE_CODE: "CLOUDINARY_AUTHENTICATED_CATALOG",
  createCloudinaryCatalogWriteAdapter: () => ({ createReadTarget: f.cloudRead }),
}));

vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessApi: f.business }));

import { GET as storeGET } from "@/app/api/store/catalog/media/[publicReference]/content/route";
import { GET } from "@/app/api/admin/catalog/media/[id]/content/route";

const bytes = catalogPngFixture();
const asset = () => ({ status: "READY", purpose: "PRODUCT_IMAGE", mimeType: "image/png", byteSize: bytes.byteLength,
  checksum: createHash("sha256").update(bytes).digest("hex"), privacyInspectionPassed: true,
  storageKey: "private-original-key", storageProvider: "S3_COMPATIBLE_CATALOG" });
function request(download = false) { return new NextRequest(`http://localhost/api/admin/catalog/media/asset/content${download ? "?download=1" : ""}`); }

describe("private catalog image review route", () => {
  beforeEach(() => {
    f.auth.mockResolvedValue({ user: { id: "reviewer" } }); f.find.mockResolvedValue(asset());
    f.read.mockResolvedValue({ body: bytes, byteSize: bytes.byteLength }); f.cloudRead.mockResolvedValue({ body: bytes, byteSize: bytes.byteLength });
  });

  it.each([401, 403])("requires catalog moderation read authority before any storage lookup (%i)", async status => {
    f.auth.mockResolvedValue({ response: new Response("Denied", { status }) });
    const response = await GET(request(), { params: Promise.resolve({ id: "asset" }) });
    expect(response.status).toBe(status); expect(f.find).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  });

  it("serves unpublished original bytes privately with safe inline/download headers", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: "asset" }) });
    expect(f.auth).toHaveBeenCalledWith(PERMISSIONS.CATALOG_MODERATION_READ, expect.any(NextRequest));
    expect(response.status).toBe(200); expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from(bytes));
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="catalog-review.png"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(JSON.stringify([...response.headers])).not.toContain("private-original-key");
    const download = await GET(request(true), { params: Promise.resolve({ id: "asset" }) });
    expect(download.headers.get("content-disposition")).toBe('attachment; filename="catalog-review.png"');
  });

  it.each([
    { status: "PENDING_UPLOAD" }, { status: "REJECTED" }, { purpose: "COMPLIANCE_DOCUMENT" },
    { mimeType: "image/svg+xml" }, { privacyInspectionPassed: false }, { checksum: null },
  ])("rejects unsafe or unvalidated review evidence: %j", async patch => {
    f.find.mockResolvedValue({ ...asset(), ...patch });
    const response = await GET(request(), { params: Promise.resolve({ id: "asset" }) });
    expect(response.status).toBe(409); expect(f.read).not.toHaveBeenCalled();
  });

  it("rejects tampering even when the returned byte count remains unchanged", async () => {
    const changed = Uint8Array.from(bytes); changed[20] ^= 1;
    f.read.mockResolvedValue({ body: changed, byteSize: changed.byteLength });
    const response = await GET(request(), { params: Promise.resolve({ id: "asset" }) });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "CATALOG_MEDIA_REVIEW_CONTENT_CHANGED" });
  });

  it("selects authenticated Cloudinary storage for validated quarantined originals", async () => {
    f.find.mockResolvedValue({ ...asset(), status: "QUARANTINED", storageProvider: "CLOUDINARY_AUTHENTICATED_CATALOG" });
    const response = await GET(request(), { params: Promise.resolve({ id: "asset" }) });
    expect(response.status).toBe(200); expect(f.cloudRead).toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
  });

  it("returns no content for missing assets", async () => {
    f.find.mockResolvedValue(null);
    expect((await GET(request(), { params: Promise.resolve({ id: "missing" }) })).status).toBe(404);
  });
});


describe("private store catalog image previews", () => {
  const storeRequest = () => new NextRequest("http://localhost/api/store/catalog/media/CMA-owned/content");
  const params = () => ({ params: Promise.resolve({ publicReference: "CMA-owned" }) });
  beforeEach(() => {
    f.business.mockResolvedValue(null);
    f.auth.mockResolvedValue({ user: { id: "owner" }, store: { id: "store-owned" } });
    f.find.mockResolvedValue(asset());
    f.read.mockResolvedValue({ body: bytes, byteSize: bytes.byteLength });
  });

  it("requires business and catalog access before looking up any image", async () => {
    f.business.mockResolvedValue(new Response("Denied", { status: 403 }));
    expect((await storeGET(storeRequest(), params())).status).toBe(403);
    expect(f.find).not.toHaveBeenCalled();
    f.business.mockResolvedValue(null);
    f.auth.mockResolvedValue({ response: new Response("Denied", { status: 401 }) });
    expect((await storeGET(storeRequest(), params())).status).toBe(401);
    expect(f.find).not.toHaveBeenCalled();
  });

  it("scopes the original lookup to this store and serves validated bytes privately", async () => {
    const response = await storeGET(storeRequest(), params());
    expect(response.status).toBe(200);
    expect(f.auth).toHaveBeenCalledWith(PERMISSIONS.CATALOG_READ, expect.any(NextRequest));
    expect(f.find).toHaveBeenCalledWith(expect.objectContaining({ where: { publicReference: "CMA-owned", ownerType: "STORE", ownerStoreId: "store-owned" } }));
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from(bytes));
  });

  it("returns no storage content for an unowned image", async () => {
    f.find.mockResolvedValue(null);
    expect((await storeGET(storeRequest(), params())).status).toBe(404);
    expect(f.read).not.toHaveBeenCalled();
  });

  it.each(["QUARANTINED", "REJECTED", "PENDING_UPLOAD"])("does not show %s images to a store", async status => {
    f.find.mockResolvedValue({ ...asset(), status });
    expect((await storeGET(storeRequest(), params())).status).toBe(409);
    expect(f.read).not.toHaveBeenCalled();
  });
});
