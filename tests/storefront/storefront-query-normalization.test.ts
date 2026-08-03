import { describe, expect, test } from "vitest";
import { normalizeStorefrontQuery } from "@/lib/storefront/search/storefront-query-normalization";
describe("storefront query normalisation", () => {
  test("folds whitespace, accents and unit aliases without losing model identifiers", () => {
    expect(normalizeStorefrontQuery("  Café   TV — 55 inches ").value).toBe("cafe tv 55 in");
    expect(normalizeStorefrontQuery("SM-A556E-DS").value).toBe("sm-a556e-ds");
  });
  test("marks bounded identifiers as exact", () => expect(normalizeStorefrontQuery("1234567890123").exactIdentifier).toBe(true));
});

