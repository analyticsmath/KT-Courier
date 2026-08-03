import { describe, expect, test } from "vitest";
import { canonicalStorefrontQuery, parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
describe("storefront filter URLs", () => {
  test("canonicalises ordering and removes duplicate facet values", () => expect(canonicalStorefrontQuery({ q: "  Tea ", facets: { size: ["L", "l", "l"] }, sort: "PRICE_ASC" })).toBe("?q=tea&f.size=l&sort=PRICE_ASC"));
  test("rejects arbitrary query keys", () => expect(parseStorefrontFilters(new URLSearchParams("evil={}&pageSize=999"))).toEqual({}));
});

