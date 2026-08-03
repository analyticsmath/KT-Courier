import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (file: string) => readFileSync(join(root, file), "utf8");

describe("R11 public static audit", () => {
  it("keeps the public home canonical while marketplace preview uses the active public projection", () => {
    expect(existsSync(join(root, "app/(public)/page.tsx"))).toBe(true);
    const page = readSource("app/(public)/page.tsx");
    const preview = readSource("components/public-v2/home/MarketplacePreview.tsx");
    expect(page).toContain("publicPageMetadata");
    expect(page).toContain("HomepageV2");
    expect(preview).toContain("getStorefrontHome");
    expect(preview).toContain("Marketplace source unavailable");
    expect(preview).not.toContain("getPublicMarketplaceState");
  });

  it("keeps functional marketplace pages metadata-backed while search and filters remain noindex", () => {
    for (const sourceFile of [
      "app/(public)/shop/categories/page.tsx",
      "app/(public)/shop/collections/page.tsx",
      "app/(public)/shop/search/page.tsx",
      "app/(public)/shop/stores/page.tsx",
      "app/(public)/shop/categories/[...categoryPath]/page.tsx",
      "app/(public)/shop/collections/[collectionSlug]/page.tsx",
      "app/(public)/shop/products/[product]/page.tsx",
      "app/(public)/shop/products/[product]/[variantReference]/page.tsx",
      "app/(public)/shop/stores/[storeSlug]/page.tsx",
      "app/(public)/shop/stores/[storeSlug]/categories/[...categoryPath]/page.tsx",
    ]) {
      expect(readSource(sourceFile)).toMatch(/generateMetadata|metadata/);
    }

    const shopLayout = readSource("app/(public)/shop/layout.tsx");
    const search = readSource("app/(public)/shop/search/page.tsx");
    const category = readSource("app/(public)/shop/categories/[...categoryPath]/page.tsx");
    expect(shopLayout).toContain("publicPageMetadata");
    expect(search).toContain("robots: { index: false, follow: true }");
    expect(category).toContain("storefrontFilterHasCrawlRisk");
    expect(shopLayout).not.toContain("StorefrontHeader");
  });
});
