import { expect, test } from "vitest";
import { storefrontProductCanonical, storefrontVariantCanonical } from "@/lib/storefront/seo/storefront-canonical-policy";
test("canonical URLs omit location and session state", () => { expect(storefrontProductCanonical("Rooibos Tea", "CP-1")).toBe("/shop/products/product-CP-1"); expect(storefrontVariantCanonical("rooibos-tea", "CP-1", "CV-1")).toBe("/shop/products/rooibos-tea-CP-1/CV-1"); });
