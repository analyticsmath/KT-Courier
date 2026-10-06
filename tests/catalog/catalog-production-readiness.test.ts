import { describe, expect, it } from "vitest";
import { assertCatalogProductionActivationAllowed, CATALOG_PRODUCTION_VALIDATION_APPROVED, type CatalogActivationKind } from "@/lib/catalog/catalog-production-lock";
import { assertExactZarPrice } from "@/lib/catalog/catalog-price-policy";
import { assertProductTransition } from "@/lib/catalog/catalog-state-machines";

describe("approved catalogue production release", () => {
  it("allows the approved activation paths", () => {
    expect(CATALOG_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    const kinds: CatalogActivationKind[] = ["PRODUCT_TYPE", "PRODUCT", "OFFER", "PRICE", "PUBLICATION"];
    for (const kind of kinds) expect(() => assertCatalogProductionActivationAllowed(kind)).not.toThrow();
  });
  it("still rejects unpriced products and direct draft activation", () => {
    expect(() => assertExactZarPrice({ amount: "0.00", currency: "ZAR", priceIncludesTax: true })).toThrow();
    expect(() => assertProductTransition("DRAFT", "ACTIVE")).toThrow();
  });
});
