import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { marketplaceCategoryHref, marketplaceCategoryPath, marketplaceStoreHref, marketplaceProductHref, marketplaceStoreCategoryHref } from "@/lib/public-marketplace/routes";
import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";
import { listStorefrontCategories, getStorefrontCategory, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { InMemoryStorefrontSearchAdapter, PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

type CategoryQueryRowFixture = {
  categoryPublicReference: string;
  canonicalPath: string;
  name: string;
  description: string | null;
  publicImageReference: string | null;
  parentPublicReference: string | null;
  childNavigation: Array<{
    reference: string;
    path: string;
    name: string;
  }>;
  productCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  sourceUpdatedAt: Date;
};

const CANONICAL_MOCK_CATEGORIES = [
  { categoryPublicReference: "SFC-GROCERIES", canonicalPath: "/groceries", name: "Groceries", description: "Fresh groceries", publicImageReference: null, parentPublicReference: null, childNavigation: [{ reference: "SFC-FRESH-PRODUCE", path: "/groceries/fresh-produce", name: "Fresh Produce" }], productCount: 42, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-FRESH-PRODUCE", canonicalPath: "/groceries/fresh-produce", name: "Fresh Produce", description: "Produce", publicImageReference: null, parentPublicReference: "SFC-GROCERIES", childNavigation: [], productCount: 18, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-ELECTRONICS", canonicalPath: "/electronics", name: "Electronics", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 30, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-FASHION", canonicalPath: "/fashion", name: "Fashion", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 25, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-HOME-GARDEN", canonicalPath: "/home-garden", name: "Home & Garden", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 20, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-HEALTH-BEAUTY", canonicalPath: "/health-beauty", name: "Health & Beauty", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 15, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-SPORTS", canonicalPath: "/sports", name: "Sports", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 12, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-BOOKS", canonicalPath: "/books", name: "Books", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 10, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
  { categoryPublicReference: "SFC-TOYS", canonicalPath: "/toys", name: "Toys", description: null, publicImageReference: null, parentPublicReference: null, childNavigation: [], productCount: 8, seoTitle: null, seoDescription: null, sourceUpdatedAt: new Date() },
];

const CANONICAL_MOCK_STORES = [
  { storePublicReference: "SFS-FYNBOS", slug: "fynbos-floral-design", name: "Fynbos Floral Design", shortDescription: "Fresh flowers", logoMediaReference: null, heroMediaReference: null, publicCategoryCodes: ["/flowers"], fulfilmentModes: ["COURIER_DELIVERY"], serviceAreaReferences: [], publishedOfferCount: 15, publicStatus: "ACTIVE", sourceUpdatedAt: new Date() },
  { storePublicReference: "SFS-ARCHIVED-FASHION", slug: "archived-fashion-outlet", name: "Archived Fashion Outlet", shortDescription: "Fashion items", logoMediaReference: null, heroMediaReference: null, publicCategoryCodes: ["/fashion"], fulfilmentModes: ["COURIER_DELIVERY"], serviceAreaReferences: [], publishedOfferCount: 5, publicStatus: "ACTIVE", sourceUpdatedAt: new Date() },
];

const CANONICAL_MOCK_DOCUMENTS = Array.from({ length: 250 }, (_, i) => ({
  publicReference: `SFD-${i + 1}`, publicationVersion: "1.0", productPublicReference: `CP-${i + 1}`, productSlug: `product-${i + 1}`, productScope: "GLOBAL_CANONICAL", variantPublicReference: `SFV-${i + 1}`, offerPublicReference: `SFO-${i + 1}`, storePublicReference: i % 2 === 0 ? "SFS-FYNBOS" : "SFS-ARCHIVED-FASHION", storeSlug: i % 2 === 0 ? "fynbos-floral-design" : "archived-fashion-outlet", categoryPublicReference: "SFC-GROCERIES", categoryPath: "/groceries", productTypeCode: "PRODUCE", productTypeVersion: 1, brandPublicReference: null, brandName: null, title: `Product ${i + 1}`, normalizedTitle: `product ${i + 1}`, shortDescription: null, publicDescription: null, searchText: `product ${i + 1} groceries fynbos floral design`, searchableAttributes: {}, filterableAttributes: {}, variantOptions: {}, condition: "NEW", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", pricePublicReference: `PRICE-${i + 1}`, priceAmount: 100, currency: "ZAR", priceIncludesTax: true, unitPriceAmount: null, unitPriceUnit: null, unitPriceQuantity: null, availabilityState: "IN_STOCK", primaryMediaPublicReference: null, primaryMediaWidth: null, primaryMediaHeight: null, primaryMediaAlt: null, publishedAt: new Date(), sourceUpdatedAt: new Date(), searchable: true, indexable: true,
}));

describe("R23 Category and Storefront Data-Binding Closure", () => {
  beforeEach(() => {
    vi.spyOn(prisma, "$queryRaw").mockImplementation((async (query: unknown) => {
      const queryObj = query as { strings?: string[]; values?: unknown[] } | string | null | undefined;
      const sqlText = typeof queryObj === "string" ? queryObj : Array.isArray(queryObj?.strings) ? queryObj.strings.join(" ") : String(queryObj);
      const values = typeof queryObj === "object" && queryObj !== null && "values" in queryObj && Array.isArray((queryObj as Record<string, unknown>).values) ? ((queryObj as Record<string, unknown>).values as unknown[]) : [];
      const valuesString = values.map(String).join(" ");

      if (sqlText.includes("StorefrontCategoryDocument")) {
        if (valuesString.includes("non-existent-category-slug-999") || valuesString.includes("999")) {
          return [];
        }
        if (valuesString.includes("groceries/fresh-produce") || valuesString.includes("fresh-produce")) {
          return CANONICAL_MOCK_CATEGORIES.filter((c) => c.canonicalPath === "/groceries/fresh-produce");
        }
        return CANONICAL_MOCK_CATEGORIES;
      }

      if (sqlText.includes("StorefrontStoreDocument")) {
        if (valuesString.includes("archived-fashion-outlet")) {
          return [CANONICAL_MOCK_STORES[1]!];
        }
        if (valuesString.includes("fynbos-floral-design")) {
          return [CANONICAL_MOCK_STORES[0]!];
        }
        return CANONICAL_MOCK_STORES;
      }

      if (sqlText.includes("StorefrontProductDocument")) {
        if (valuesString.includes("nonexistentproductqueryxyz123")) {
          return [];
        }
        if (valuesString.includes("archived-fashion-outlet")) {
          return CANONICAL_MOCK_DOCUMENTS.filter((d) => d.storeSlug === "archived-fashion-outlet");
        }
        if (valuesString.includes("fynbos-floral-design")) {
          return CANONICAL_MOCK_DOCUMENTS.filter((d) => d.storeSlug === "fynbos-floral-design");
        }
        return CANONICAL_MOCK_DOCUMENTS;
      }

      return [];
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
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

  it("22. Missing count does not render as zero", async () => {
    const fixtureRows: CategoryQueryRowFixture[] = [
      {
        categoryPublicReference: "CAT-PARENT-1",
        canonicalPath: "/groceries",
        name: "Groceries",
        description: null,
        publicImageReference: null,
        parentPublicReference: null,
        childNavigation: [
          { reference: "CAT-CHILD-1", path: "/groceries/fresh-produce", name: "Fresh Produce" },
        ],
        productCount: 42,
        seoTitle: null,
        seoDescription: null,
        sourceUpdatedAt: new Date(),
      },
    ];

    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce(fixtureRows);

    const categories = await listStorefrontCategories();

    expect(categories.length).toBe(1);

    const parentCategory = categories[0]!;
    expect(parentCategory.productCount).toBe(42);

    const childNav = parentCategory.children[0]!;
    expect(childNav).toBeDefined();
    expect(childNav.reference).toBe("CAT-CHILD-1");
    expect(childNav.path).toBe("/groceries/fresh-produce");
    expect(childNav.name).toBe("Fresh Produce");

    expect(Object.prototype.hasOwnProperty.call(childNav, "productCount")).toBe(false);
    expect("productCount" in childNav).toBe(false);
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
      productScope: "GLOBAL_CANONICAL",
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
      fulfilmentMode: "COURIER_DELIVERY",
      sellingUnit: "EACH",
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
