import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { source } from "@/tests/storefront/storefront-test-helpers";

const sitemapMocks = vi.hoisted(() => ({
  exposureAllowed: false,
  listCategories: vi.fn(),
  listStores: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/lib/storefront/storefront-production-lock", () => ({
  storefrontPublicExposureAllowed: () => sitemapMocks.exposureAllowed,
}));

vi.mock("@/lib/services/storefront-catalog.service", () => ({
  listStorefrontCategories: sitemapMocks.listCategories,
  listStorefrontStores: sitemapMocks.listStores,
}));

vi.mock("@/lib/storefront/search/storefront-search-adapter", () => ({
  PostgresStorefrontSearchAdapter: class {
    search = sitemapMocks.search;
  },
}));

import sitemap from "@/app/(public)/shop/sitemap";

test("sitemap service only reads current canonical adapter documents behind the source lock", () => { const sitemap = source("app/(public)/shop/sitemap.ts"); expect(sitemap).toContain("PostgresStorefrontSearchAdapter"); expect(sitemap).toContain("document.indexable"); expect(sitemap).toContain("storefrontPublicExposureAllowed"); });

describe("storefront sitemap runtime behavior", () => {
  beforeEach(() => {
    sitemapMocks.exposureAllowed = false;
    sitemapMocks.listCategories.mockReset();
    sitemapMocks.listStores.mockReset();
    sitemapMocks.search.mockReset();
  });

  it("returns no entries without querying canonical projections when public exposure is denied", async () => {
    await expect(sitemap({ id: Promise.resolve("products") })).resolves.toEqual([]);

    expect(sitemapMocks.listCategories).not.toHaveBeenCalled();
    expect(sitemapMocks.listStores).not.toHaveBeenCalled();
    expect(sitemapMocks.search).not.toHaveBeenCalled();
  });

  it("emits only canonical category URLs", async () => {
    sitemapMocks.exposureAllowed = true;
    sitemapMocks.listCategories.mockResolvedValue([
      { path: "/groceries/fresh-produce", updatedAt: "2026-08-01T00:00:00.000Z" },
      { path: "/invalid path", updatedAt: "2026-08-01T00:00:00.000Z" },
    ]);

    await expect(sitemap({ id: Promise.resolve("categories") })).resolves.toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/shop\/categories\/groceries\/fresh-produce$/) }),
    ]);
  });

  it("emits only canonical public store URLs", async () => {
    sitemapMocks.exposureAllowed = true;
    sitemapMocks.listStores.mockResolvedValue([{ slug: "tea-store" }, { slug: "invalid store" }]);

    await expect(sitemap({ id: Promise.resolve("stores") })).resolves.toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/shop\/stores\/tea-store$/) }),
    ]);
  });

  it("emits deduplicated indexable product URLs and canonical variant URLs", async () => {
    sitemapMocks.exposureAllowed = true;
    sitemapMocks.search.mockResolvedValue([
      { indexable: true, productReference: "CP-TEA", productSlug: "rooibos-tea", variantReference: "CV-500G", sourceUpdatedAt: "2026-08-01T00:00:00.000Z" },
      { indexable: true, productReference: "CP-TEA", productSlug: "rooibos-tea", variantReference: "CV-1KG", sourceUpdatedAt: "2026-08-01T00:00:00.000Z" },
      { indexable: false, productReference: "CP-NOT-INDEXABLE", productSlug: "hidden-tea", variantReference: "CV-HIDDEN", sourceUpdatedAt: "2026-08-01T00:00:00.000Z" },
    ]);

    await expect(sitemap({ id: Promise.resolve("products") })).resolves.toHaveLength(1);
    await expect(sitemap({ id: Promise.resolve("variants") })).resolves.toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/shop\/products\/rooibos-tea-CP-TEA\/CV-500G$/) }),
      expect.objectContaining({ url: expect.stringMatching(/\/shop\/products\/rooibos-tea-CP-TEA\/CV-1KG$/) }),
    ]);
  });

  it("does not query product projections for unsupported collections", async () => {
    sitemapMocks.exposureAllowed = true;

    await expect(sitemap({ id: Promise.resolve("collections") })).resolves.toEqual([]);
    expect(sitemapMocks.search).not.toHaveBeenCalled();
  });

  it("preserves canonical projection failures", async () => {
    sitemapMocks.exposureAllowed = true;
    sitemapMocks.search.mockRejectedValue(new Error("database unavailable"));

    await expect(sitemap({ id: Promise.resolve("products") })).rejects.toThrow("database unavailable");
  });
});
