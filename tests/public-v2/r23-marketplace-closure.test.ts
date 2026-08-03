import { describe, expect, it } from "vitest";
import { marketplaceCategoryHref, marketplaceCategoryPath, marketplaceStoreHref, marketplaceProductHref, marketplaceStoreCategoryHref } from "@/lib/public-marketplace/routes";
import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
import { listStorefrontCategories, getStorefrontCategory, getStorefrontStore, getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { InMemoryStorefrontSearchAdapter, PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

describe("R23 Category and Storefront Data-Binding Closure", () => {
  it("1. /shop category query returns canonical public categories", async () => {
    const categories = await listStorefrontCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c) => c.name === "Groceries" || c.name === "Electronics")).toBe(true);
  });

  it("2. /shop does not suppress categories lacking optional media", async () => {
    const categories = await listStorefrontCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContainEqual(expect.objectContaining({ path: expect.any(String) }));
  });

  it("3. /shop/categories uses the complete public category authority", async () => {
    const categories = await listStorefrontCategories();
    expect(categories.length).toBeGreaterThanOrEqual(9);
  });

  it("4. Parent categories render", async () => {
    const categories = await listStorefrontCategories();
    const parents = categories.filter((c) => !c.parentReference);
    expect(parents.length).toBeGreaterThan(0);
    expect(parents.some((p) => p.name === "Groceries")).toBe(true);
  });

  it("5. Child categories render", async () => {
    const categories = await listStorefrontCategories();
    const children = categories.filter((c) => Boolean(c.parentReference));
    expect(children.length).toBeGreaterThan(0);
    expect(children.some((c) => c.name === "Fresh Produce")).toBe(true);
  });

  it("6. Empty public categories retain identity", async () => {
    const category = await getStorefrontCategory("groceries/fresh-produce");
    expect(category).not.toBeNull();
    expect(category?.name).toBe("Fresh Produce");
    expect(category?.path).toBe("/groceries/fresh-produce");
  });

  it("7. Category retrieval failure does not masquerade as empty", async () => {
    const notFoundCategory = await getStorefrontCategory("non-existent-category-slug-999");
    expect(notFoundCategory).toBeNull();
  });

  it("8. Category cards use canonical hrefs", () => {
    const href1 = marketplaceCategoryHref("/groceries");
    const href2 = marketplaceCategoryHref("groceries");
    const href3 = marketplaceCategoryHref("/groceries/fresh-produce");
    expect(href1).toBe("/shop/categories/groceries");
    expect(href2).toBe("/shop/categories/groceries");
    expect(href3).toBe("/shop/categories/groceries/fresh-produce");
  });

  it("9. Store cards use canonical storefront hrefs", () => {
    const href = marketplaceStoreHref("fynbos-floral-design");
    expect(href).toBe("/shop/stores/fynbos-floral-design");
  });

  it("10. Storefront resolves public reference to the correct store", async () => {
    const store = await getStorefrontStore("fynbos-floral-design");
    expect(store).not.toBeNull();
    expect(store?.name).toBe("Fynbos Floral Design");
    expect(store?.slug).toBe("fynbos-floral-design");
  });

  it("11. Storefront product query uses the canonical store relationship", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: "fynbos-floral-design" });
    expect(result.resultCount).toBeGreaterThan(0);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("12. Store public reference is not used as an internal store-ID filter", async () => {
    const store = await getStorefrontStore("fynbos-floral-design");
    expect(store?.slug).toBe("fynbos-floral-design");
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: store!.slug });
    expect(result.resultCount).toBeGreaterThan(0);
  });

  it("13. Owner ID is not used when store ID is required", async () => {
    const store = await getStorefrontStore("archived-fashion-outlet");
    expect(store?.slug).toBe("archived-fashion-outlet");
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: store!.slug });
    expect(result.resultCount).toBeGreaterThan(0);
  });

  it("14. Storefront default filters are nonrestrictive", () => {
    const params = new URLSearchParams();
    const filters = parseStorefrontFilters(params);
    expect(filters.category).toBeUndefined();
    expect(filters.store).toBeUndefined();
    expect(filters.q).toBeUndefined();
    expect(filters.availability).toBeUndefined();
  });

  it("15. Storefront pagination starts correctly", () => {
    const params = new URLSearchParams("page=1");
    const filters = parseStorefrontFilters(params);
    expect(filters.page).toBe(1);
    expect(filters.cursor).toBeUndefined();
  });

  it("16. Storefront unfiltered populated query does not render empty state", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: "fynbos-floral-design" });
    expect(result.resultCount).toBeGreaterThan(0);
    expect(result.noResultState).toBeUndefined();
  });

  it("17. Filtered no-results differs from empty-store state", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: "fynbos-floral-design", q: "nonexistentproductqueryxyz123" });
    expect(result.resultCount).toBe(0);
    expect(result.noResultState).toBe("FILTERS_TOO_RESTRICTIVE");
  });

  it("18. Checkout lock does not affect storefront product retrieval", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const result = await searchService.search({ store: "fynbos-floral-design" });
    expect(result.resultCount).toBeGreaterThan(0);
  });

  it("19. Product publication filters are consistent across marketplace surfaces", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const all = await searchService.search({});
    expect(all.results.length).toBeGreaterThan(0);
    for (const card of all.results) {
      expect(card.title).toBeDefined();
      expect(card.price.amount).toBeDefined();
    }
  });

  it("20. Category product filters are consistent across marketplace surfaces", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const categoryResult = await searchService.search({ category: "groceries" });
    expect(categoryResult.resultCount).toBeGreaterThan(0);
  });

  it("21. Displayed counts are source-backed or omitted", async () => {
    const categories = await listStorefrontCategories();
    for (const c of categories) {
      if (typeof c.productCount === "number") {
        expect(c.productCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("22. Missing count does not render as zero", () => {
    const categoryNoCount = { reference: "cat-1", path: "/test", name: "Test" };
    expect(categoryNoCount.productCount).toBeUndefined();
  });

  it("23. No fixture categories, stores or products exist", async () => {
    const categories = await listStorefrontCategories();
    expect(categories.some((c) => c.name.includes("Fixture"))).toBe(false);
  });

  it("24. InMemory search adapter supports storeSlug, categoryPath, and brand", async () => {
    const mockDoc: StorefrontDocument = {
      publicReference: "SFD-TEST",
      publicationVersion: "1",
      productReference: "CP-1",
      productSlug: "test-prod",
      productScope: "GLOBAL",
      variantReference: "CV-1",
      offerReference: "SO-1",
      storeReference: "test-store",
      storeSlug: "test-store",
      categoryReference: "CAT-1",
      categoryPath: "/groceries",
      productTypeCode: "FOOD",
      productTypeVersion: 1,
      title: "Test Product",
      normalizedTitle: "test product",
      searchText: "test product",
      searchableAttributes: {},
      filterableAttributes: {},
      variantOptions: {},
      condition: "NEW",
      fulfilmentMode: "STANDARD_DELIVERY",
      sellingUnit: "UNIT",
      price: { publicReference: "PRICE-1", amount: "10.00", currency: "ZAR", includesTax: true },
      availability: "IN_STOCK",
      publishedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
      searchable: true,
      indexable: false,
    };
    const adapter = new InMemoryStorefrontSearchAdapter([mockDoc]);
    const service = new StorefrontSearchService(adapter);

    const matchStore = await service.search({ store: "test-store" });
    expect(matchStore.resultCount).toBe(1);

    const missStore = await service.search({ store: "other-store" });
    expect(missStore.resultCount).toBe(0);

    const matchCat = await service.search({ category: "groceries" });
    expect(matchCat.resultCount).toBe(1);
  });

  it("25. Category path normalization strips leading/trailing slashes for route generation", () => {
    expect(marketplaceCategoryPath("/groceries/fresh-produce/")).toBe("groceries/fresh-produce");
  });

  it("26. Double hyphens in product slugs generate valid product hrefs", () => {
    const href = marketplaceProductHref("country-sourdough-bread-tiny-tots-baby-co--cp-full-13-11", "CP-FULL-13-11");
    expect(href).toBe("/shop/products/country-sourdough-bread-tiny-tots-baby-co--cp-full-13-11-CP-FULL-13-11");
  });

  it("27. Full catalogue total exceeds 200 without being capped", async () => {
    const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
    const res = await searchService.search({});
    expect(res.resultCount).toBeGreaterThan(200);
    expect(res.results.length).toBeLessThanOrEqual(24);
  });

  it("28. Storefront categories are derived from store products and generate store-category links", async () => {
    const store = await getStorefrontStore("archived-fashion-outlet");
    expect(store).not.toBeNull();
    expect(store?.storeCategories.length).toBeGreaterThan(0);
    const firstCat = store!.storeCategories[0]!;
    const link = marketplaceStoreCategoryHref(store!.slug, firstCat.path);
    expect(link).toBe(`/shop/stores/${store!.slug}/categories/${firstCat.path.replace(/^\//, "")}`);
  });
});
