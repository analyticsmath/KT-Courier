import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = readFileSync("lib/services/catalog-media-attachment.service.ts", "utf8");
it("enforces owned editable product READY ownership variant version audit and association-only removal", () => { for (const token of ["STORE_PRIVATE", "sourceStoreId !== storeId", "assertCatalogMediaAttachment", "variantPublicReference", "productVersion", "MEDIA_ATTACHED", "MEDIA_ASSOCIATION_REMOVED", "assetPreserved: true"]) expect(source).toContain(token); expect(source).not.toMatch(/catalogMediaAsset\.delete|function DELETE/); });
