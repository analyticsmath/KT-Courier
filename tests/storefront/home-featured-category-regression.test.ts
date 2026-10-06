import { afterEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { FEATURED_MARKETPLACE_CATEGORY_PATHS, selectFeaturedMarketplaceCategories } from "@/lib/public-marketplace/featured-categories";

afterEach(() => vi.restoreAllMocks());

it("keeps all five compulsory Shop worlds after earlier legacy roots fill the home limit", async () => {
  const paths = [...Array.from({ length: 18 }, (_, i) => `a-legacy-${i}`), ...FEATURED_MARKETPLACE_CATEGORY_PATHS];
  const categories = paths.sort().map(path => ({
    categoryPublicReference: path, canonicalPath: `/${path}`, name: path,
    description: null, publicImageReference: null, parentPublicReference: null,
    childNavigation: [], productCount: 0, seoTitle: null, seoDescription: null,
    sourceUpdatedAt: new Date("2026-10-06T00:00:00Z"),
  }));
  vi.spyOn(prisma, "$queryRaw").mockImplementation((async (query: unknown) => {
    const sql = (query as { strings?: string[] }).strings?.join(" ") ?? String(query);
    return sql.includes("StorefrontCategoryDocument") ? categories : [];
  }) as never);
  vi.spyOn(StorefrontSearchService.prototype, "search").mockResolvedValue({ results: [] } as never);
  const home = await getStorefrontHome({ includeCollections: false });
  expect(home.categories).toHaveLength(12);
  expect(selectFeaturedMarketplaceCategories(home.categories).map(category => category.path))
    .toEqual(FEATURED_MARKETPLACE_CATEGORY_PATHS.map(path => `/${path}`));
});
