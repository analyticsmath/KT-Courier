import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPackagingSchema } from "@/lib/validation/catalog-packaging";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/commercial/parcel-profiles", () => ({ publicParcelProfiles: async () => [{ lengthCm: 70, widthCm: 50, heightCm: 50, maximumWeightKg: 30 }] }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { saveCatalogPackaging } from "@/lib/services/catalog-packaging.service";
const input = { lengthCm: 20, widthCm: 15, heightCm: 5, weightKg: 1.2, description: "One sealed package including protective padding." };
beforeEach(() => vi.clearAllMocks());
describe("vendor package evidence", () => {
  it("rejects invalid measurements and unsupported precision", () => { for (const lengthCm of [0, -1, Infinity, 1001, 1.12345]) expect(CatalogPackagingSchema.safeParse({ ...input, lengthCm }).success).toBe(false); expect(CatalogPackagingSchema.safeParse(input).success).toBe(true); });
  it("rejects packages beyond configured courier limits", async () => { await expect(saveCatalogPackaging("store", "actor", "CO-test", { ...input, lengthCm: 71 }, {} as never)).rejects.toMatchObject({ code: "PACKAGE_LIMIT_EXCEEDED" }); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("checks store ownership before writing package evidence", async () => { mocks.findFirst.mockResolvedValue(null); const tx = { storeCatalogOffer: { findFirst: mocks.findFirst }, systemSetting: { upsert: mocks.upsert }, adminActivityLog: { create: mocks.create } }; await expect(saveCatalogPackaging("wrong-store", "actor", "CO-test", input, tx as never)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" }); expect(mocks.upsert).not.toHaveBeenCalled(); });
  it("records measurements as a new auditable declaration without commercial approval", async () => { mocks.findFirst.mockResolvedValue({ id: "offer-id" }); const tx = { storeCatalogOffer: { findFirst: mocks.findFirst }, systemSetting: { upsert: mocks.upsert }, adminActivityLog: { create: mocks.create } }; const first = await saveCatalogPackaging("store", "actor", "CO-test", input, tx as never); const second = await saveCatalogPackaging("store", "actor", "CO-test", input, tx as never); expect(first.revision).not.toBe(second.revision); expect(first).not.toHaveProperty("approvedByUserId"); expect(mocks.upsert.mock.calls[0][0].create.value).toMatchObject({ ...input, storeId: "store", actorUserId: "actor" }); expect(mocks.create).toHaveBeenCalledTimes(2); });
});
