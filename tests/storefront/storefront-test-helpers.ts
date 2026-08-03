import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

export function source(path: string): string { return readFileSync(resolve(process.cwd(), path), "utf8"); }
export function document(overrides: Partial<StorefrontDocument> = {}): StorefrontDocument {
  return { publicReference: "SFD-00000000000000000000000000000000", publicationVersion: "1234567890123456", productReference: "CP-00000000000000000000000000000000", productSlug: "rooibos-tea", productScope: "GLOBAL_CANONICAL", variantReference: "CV-00000000000000000000000000000000", offerReference: "CO-00000000000000000000000000000000", storeReference: "tea-store", storeSlug: "tea-store", categoryReference: "CC-00000000000000000000000000000000", categoryPath: "food/tea", productTypeCode: "TEA", productTypeVersion: 1, title: "Rooibos Tea", normalizedTitle: "rooibos tea", searchText: "rooibos tea herbal food", searchableAttributes: {}, filterableAttributes: {}, variantOptions: { size: "500 g" }, condition: "NEW", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", price: { publicReference: "CPV-00000000000000000000000000000000", amount: "10.00", currency: "ZAR", includesTax: true }, availability: "IN_STOCK", publishedAt: "2026-01-01T00:00:00.000Z", sourceUpdatedAt: "2026-01-01T00:00:00.000Z", searchable: true, indexable: false, ...overrides };
}
