import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPackagingSchema } from "@/lib/validation/catalog-packaging";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/commercial/parcel-profiles", () => ({ publicParcelProfiles: async () => [{ lengthCm: 70, widthCm: 50, heightCm: 50, maximumWeightKg: 30 }] }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { systemSetting: { findUnique: mocks.findUnique } } }));
import { saveCatalogPackaging, findCatalogPackagingDeclaration } from "@/lib/services/catalog-packaging.service";
const input = { lengthCm: 20, widthCm: 15, heightCm: 5, weightKg: 1.2, description: "One sealed package including protective padding." };
beforeEach(() => vi.clearAllMocks());
describe("vendor package evidence", () => {
  it("retrieves the exact vendor revision outside the newest 500 global records", async () => {
    const declaration = { ...input, offerReference: "CO-older", storeId: "store-a", actorUserId: "vendor-a", revision: "b8a51352-1fc0-4d80-9e84-6ef7618d6e31", submittedAt: "2026-10-25T08:00:00.000Z" };
    mocks.findUnique.mockResolvedValue({ value: declaration });
    await expect(findCatalogPackagingDeclaration(declaration.offerReference, declaration.revision)).resolves.toEqual(declaration);
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { key: "vendor_catalog_packaging:CO-older" } });
    await expect(findCatalogPackagingDeclaration(declaration.offerReference, "57e9e062-1de2-4c1e-94dd-a205d57b0afb")).resolves.toBeNull();
    mocks.findUnique.mockResolvedValue({ value: { ...declaration, offerReference: "CO-foreign" } });
    await expect(findCatalogPackagingDeclaration(declaration.offerReference, declaration.revision)).resolves.toBeNull();
    mocks.findUnique.mockResolvedValue({ value: { ...declaration, weightKg: -10 } });
    await expect(findCatalogPackagingDeclaration(declaration.offerReference, declaration.revision)).resolves.toBeNull();
  });
  it("rejects invalid measurements and unsupported precision", () => { for (const lengthCm of [0, -1, Infinity, 1001, 1.12345]) expect(CatalogPackagingSchema.safeParse({ ...input, lengthCm }).success).toBe(false); expect(CatalogPackagingSchema.safeParse(input).success).toBe(true); });
  it("rejects packages beyond configured courier limits", async () => { await expect(saveCatalogPackaging("store", "actor", "CO-test", { ...input, lengthCm: 71 }, {} as never)).rejects.toMatchObject({ code: "PACKAGE_LIMIT_EXCEEDED" }); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("checks store ownership before writing package evidence", async () => { mocks.findFirst.mockResolvedValue(null); const tx = { storeCatalogOffer: { findFirst: mocks.findFirst }, systemSetting: { upsert: mocks.upsert }, adminActivityLog: { create: mocks.create } }; await expect(saveCatalogPackaging("wrong-store", "actor", "CO-test", input, tx as never)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" }); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("records measurements as a new auditable declaration without commercial approval", async () => { mocks.findFirst.mockResolvedValue({ id: "offer-id" }); const tx = { storeCatalogOffer: { findFirst: mocks.findFirst }, systemSetting: { upsert: mocks.upsert }, adminActivityLog: { create: mocks.create } }; const first = await saveCatalogPackaging("store", "actor", "CO-test", input, tx as never); const second = await saveCatalogPackaging("store", "actor", "CO-test", input, tx as never); expect(first.revision).not.toBe(second.revision); expect(first).not.toHaveProperty("approvedByUserId"); expect(mocks.upsert.mock.calls[0][0].create.value).toMatchObject({ ...input, storeId: "store", actorUserId: "actor" }); expect(mocks.create).toHaveBeenCalledTimes(2); });
});
