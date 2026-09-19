import { expect, it } from "vitest";
import { CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED, assertCatalogMediaProductionActionAllowed } from "@/lib/catalog/media/catalog-media-production-lock";
import { createProductionCatalogMediaStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";

it("uses explicit production approval while still requiring configured durable storage", async () => {
  expect(CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED).toBe(true);
  expect(() => assertCatalogMediaProductionActionAllowed("PUBLIC_DELIVERY")).not.toThrow();
  const adapter = createProductionCatalogMediaStorageAdapter({});
  expect(adapter.productionReady).toBe(false);
  await expect(adapter.openForValidation({ storageKey: "catalog-media/missing", maximumBytes: 1 })).rejects.toMatchObject({
    code: "CATALOG_MEDIA_STORAGE_NOT_READY",
  });
});
