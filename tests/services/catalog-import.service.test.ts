import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), createProduct: vi.fn(), raw: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({ $queryRaw: m.raw, catalogImportJob: { findUnique: m.find, update: m.update } }) } }));
vi.mock("@/lib/services/catalog-product.service", () => ({ createStorePrivateCatalogProduct: m.createProduct }));
import { applyCatalogImportJob, validateCatalogImportJob } from "@/lib/services/catalog-import.service";
beforeEach(() => vi.clearAllMocks());
it("refuses foreign store imports before creating products or updating jobs", async () => {
  m.find.mockResolvedValue({ storeId: "other", rows: [] });
  await expect(applyCatalogImportJob("own", "actor", "CIJ-test")).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
  await expect(validateCatalogImportJob("own", "CIJ-test")).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
  expect(m.createProduct).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it("refuses incomplete completed receipts instead of fabricating a successful retry", async () => {
  m.find.mockResolvedValue({ storeId: "own", status: "COMPLETED", rows: [{ status: "VALID", resultingProductId: null }] });
  await expect(applyCatalogImportJob("own", "actor", "CIJ-test")).rejects.toMatchObject({ code: "IMPORT_RECEIPT_INVALID" });
  expect(m.createProduct).not.toHaveBeenCalled();
});
it("returns an existing complete receipt without creating duplicate products", async () => {
  const receipt = { storeId: "own", status: "COMPLETED", totalRows: 1, validRows: 1, invalidRows: 0, rows: [{ status: "APPLIED", resultingProductId: "product" }] };
  m.find.mockResolvedValue(receipt);
  expect(await applyCatalogImportJob("own", "actor", "CIJ-test")).toEqual(receipt);
  expect(m.createProduct).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
