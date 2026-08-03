import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
import { source } from "@/tests/storefront/storefront-test-helpers";

test("public storefront handlers expose only safe read methods", () => {
  const publicRoutes = ["app/api/storefront/home/route.ts", "app/api/storefront/search/route.ts", "app/api/storefront/products/[publicReference]/route.ts", "app/api/storefront/stores/route.ts", "app/api/storefront/collections/[slug]/route.ts"];
  for (const route of publicRoutes) expect(source(route)).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
});

test("search bounds query, facets, values, page size, and parameterised adapter input", () => {
  const parsed = parseStorefrontFilters(new URLSearchParams(`q=${"x".repeat(300)}&pageSize=999&${Array.from({ length: 12 }, (_, index) => `f.f${index}=a,b,c,d,e,f,g,h,i`).join("&")}`));
  expect(parsed.pageSize).toBeUndefined();
  expect(Object.keys(parsed.facets ?? {})).toHaveLength(8);
  expect(Object.values(parsed.facets ?? {}).every((values) => values.length <= 8)).toBe(true);
  expect(source("lib/storefront/search/storefront-search-adapter.ts")).toContain("Prisma.sql");
});

test("location deletion is safe and public DTOs omit stock, storage keys, and moderation", () => {
  const deletion = source("app/api/storefront/location/route.ts"); const catalog = source("lib/services/storefront-catalog.service.ts");
  expect(deletion).toContain("maxAge: 0");
  expect(catalog).not.toMatch(/storageKey|availableQuantit(?:y|ies)|moderationStatus|internalId/i);
});

test("preview is authorized, no-store, noindex, and storefront has no cart endpoints", () => {
  const preview = source("app/api/storefront/preview/[snapshotReference]/route.ts");
  expect(preview).toContain("hasPermission"); expect(preview).toContain("robots: \"noindex\""); expect(preview).toContain("private: true");
  expect(existsSync("app/api/storefront/cart")).toBe(false); expect(existsSync("app/api/storefront/checkout")).toBe(false); expect(existsSync("app/api/storefront/reservation")).toBe(false);
});

test("anonymous product and store routes fail safely behind the source lock", () => {
  const product = source("app/api/storefront/products/[publicReference]/route.ts"); const store = source("app/api/storefront/stores/[slug]/route.ts");
  expect(product).toContain("assertStorefrontPublicExposureAllowed"); expect(product).toContain("storefrontNotFound");
  expect(store).toContain("assertStorefrontPublicExposureAllowed"); expect(store).toContain("storefrontNotFound");
});

test("public search has deterministic cursor policy and rate limiting", () => {
  const route = source("app/api/storefront/search/route.ts"); const search = source("lib/storefront/search/storefront-search.service.ts");
  expect(route).toContain('enforceStorefrontRateLimit(request, "search")'); expect(search).toContain("CURSOR_VERSION"); expect(search).toContain("MAX_PAGE_SIZE = 48");
});
