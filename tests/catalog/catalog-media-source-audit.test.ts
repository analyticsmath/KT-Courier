import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "lib/catalog/media/catalog-media-production-lock.ts",
  "lib/catalog/media/catalog-media-storage-adapter.ts",
  "lib/services/catalog-media-intake.service.ts",
  "lib/catalog/media/catalog-media-route-handlers.ts",
  "lib/catalog/media/catalog-media-delivery.ts",
  "prisma/migrations/20260717100000_phase18_product_catalog/migration.sql",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
describe("catalog media source audit", () => {
  it("has no environment approval bypass, caller-selected remote ingestion, cloud credential or DELETE route", () => {
    expect(files).not.toMatch(
      /process(?:\.env|\["env"\])(?:\.|\[).*CATALOG_MEDIA_PRODUCTION_VALIDATION|fetch\(input\.[^)]*(?:url|Url)|AWS_|AZURE_|GOOGLE_|function DELETE|export async function DELETE/,
    );
  });
  it("generates storage keys server-side and keeps them out of safe DTOs", () => {
    expect(files).toMatch(/randomBytes\(32\)/);
    const dto = files.match(/function safeAssetDto[\s\S]*?\n}/)?.[0] ?? "";
    expect(dto).not.toMatch(/storageKey|storageProvider/);
  });
  it("contains structural ownership READY immutability and attachment guards", () => {
    expect(files).toMatch(/CatalogMediaAsset_owner_check/);
    expect(files).toMatch(/CatalogMediaAsset_ready_evidence_check/);
    expect(files).toMatch(/CATALOG_MEDIA_STORAGE_KEY_IMMUTABLE/);
    expect(files).toMatch(/CatalogProductMedia_guard/);
    expect(files).toMatch(/CatalogMediaHistory_immutable/);
  });
});
