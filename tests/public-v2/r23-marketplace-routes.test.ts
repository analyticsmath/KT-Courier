import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  marketplaceCategoryHref,
  marketplaceListingHref,
  marketplaceProductHref,
  marketplaceStoreCategoryHref,
  marketplaceStoreHref,
  marketplaceVariantHref,
  parseMarketplaceProductParameter,
} from "@/lib/public-marketplace/routes";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");
const routeFiles = {
  shop: "app/(public)/shop/page.tsx",
  categories: "app/(public)/shop/categories/page.tsx",
  category: "app/(public)/shop/categories/[...categoryPath]/page.tsx",
  stores: "app/(public)/shop/stores/page.tsx",
  store: "app/(public)/shop/stores/[storeSlug]/page.tsx",
  storeCategory: "app/(public)/shop/stores/[storeSlug]/categories/[...categoryPath]/page.tsx",
  product: "app/(public)/shop/products/[product]/page.tsx",
  variant: "app/(public)/shop/products/[product]/[variantReference]/page.tsx",
  search: "app/(public)/shop/search/page.tsx",
} as const;

describe("R23 marketplace route activation", () => {
  it("builds source-backed category, store, product, store-category, and variant links to mounted public routes", () => {
    expect(marketplaceCategoryHref("food/tea")).toBe("/shop/categories/food/tea");
    expect(marketplaceStoreHref("tea-store")).toBe("/shop/stores/tea-store");
    expect(marketplaceStoreCategoryHref("tea-store", "food/tea")).toBe("/shop/stores/tea-store/categories/food/tea");
    expect(marketplaceProductHref("rooibos-tea", "CP-1")).toBe("/shop/products/rooibos-tea-CP-1");
    expect(marketplaceVariantHref("rooibos-tea", "CP-1", "CV-1")).toBe("/shop/products/rooibos-tea-CP-1/CV-1");
    for (const file of Object.values(routeFiles)) expect(existsSync(path.join(root, file))).toBe(true);
  });

  it("accepts only canonical, safely encoded dynamic records and cannot create an external or double-encoded destination", () => {
    expect(marketplaceCategoryHref("food/rooibos tea")).toBeNull();
    expect(marketplaceStoreHref("https://outside.example")).toBeNull();
    expect(marketplaceProductHref("rooibos-tea", "CP-1/../../private")).toBeNull();
    expect(marketplaceProductHref("rooibos-tea", "CP-1")).not.toContain("%25");
    expect(parseMarketplaceProductParameter("rooibos-tea-CP-1")).toEqual({ slug: "rooibos-tea", reference: "CP-1" });
    expect(parseMarketplaceProductParameter("rooibos tea-CP-1")).toBeNull();
  });

  it("shares validated URL-backed filtering between search, category, and storefront listings", () => {
    expect(marketplaceListingHref({ kind: "search" }, { q: "rooibos tea", sort: "PRICE_ASC" })).toBe("/shop/search?q=rooibo+tea&sort=PRICE_ASC");
    expect(marketplaceListingHref({ kind: "category", categoryPath: "food/tea" }, { availability: ["IN_STOCK"] })).toBe("/shop/categories/food/tea?availability=in+stock");
    expect(marketplaceListingHref({ kind: "store", storeSlug: "tea-store" }, { q: "herbal" })).toBe("/shop/stores/tea-store?q=herbal");
  });

  it("uses the same href builders in marketplace cards, homepage previews, search, metadata, and the sitemap", () => {
    const cards = source("components/public-v2/marketplace/MarketplaceCards.tsx");
    const homepage = source("components/public-v2/home/MarketplacePreview.tsx");
    const sitemap = source("app/(public)/shop/sitemap.ts");
    const search = source(routeFiles.search);
    expect(cards).toContain("marketplaceCategoryHref");
    expect(cards).toContain("marketplaceStoreHref");
    expect(cards).toContain("marketplaceProductHref");
    expect(homepage).toContain("MarketplaceProductGrid");
    expect(search).toContain("MarketplaceSearchDiscovery");
    expect(sitemap).toContain("marketplaceVariantHref");
    expect(sitemap).toContain("storefrontPublicExposureAllowed");
    expect(sitemap).toContain('export const dynamic = "force-dynamic"');
  });

  it("resolves public records before presentation and never lets an obsolete browse placeholder intercept them", () => {
    const browsePages = [routeFiles.shop, routeFiles.categories, routeFiles.category, routeFiles.stores, routeFiles.store, routeFiles.storeCategory, routeFiles.product, routeFiles.variant, routeFiles.search].map(source).join("\n");
    expect(browsePages).not.toContain("MarketplaceUnavailable");
    expect(browsePages).not.toContain("marketplaceBrowsingAvailable");
    expect(browsePages).not.toContain("storefrontPublicExposureAllowed");
    expect(source(routeFiles.category)).toContain("getStorefrontCategory");
    expect(source(routeFiles.store)).toContain("getStorefrontStore");
    expect(source(routeFiles.product)).toContain("getStorefrontProduct");
    expect(source(routeFiles.variant)).toContain("getStorefrontVariant");
    expect(source(routeFiles.search)).toContain("StorefrontSearchService");
  });

  it("keeps category, storefront, product, empty, missing-media, and server-search states source-backed", () => {
    const category = source(routeFiles.category);
    const store = source(routeFiles.store);
    const product = source(routeFiles.product);
    const results = source("components/public-v2/marketplace/MarketplaceResults.tsx");
    const cards = source("components/public-v2/marketplace/MarketplaceCards.tsx");
    expect(category).toContain("MarketplaceCategoryRail");
    expect(category).toContain("No products in this category yet");
    expect(store).toContain("No published products yet");
    expect(product).toContain("Purchase controls are unavailable");
    expect(product).toContain("getStorefrontStore");
    expect(cards).toContain("image unavailable");
    expect(results).toContain("StorefrontSearchResponse");
    expect(results).not.toContain('"use client"');
  });

  it("keeps product grids semantic, avoids fake commerce claims, and leaves checkout locked separately", () => {
    const sources = [
      source("components/public-v2/marketplace/MarketplaceCards.tsx"),
      source("components/public-v2/marketplace/MarketplaceResults.tsx"),
      source(routeFiles.product),
      source(routeFiles.store),
      source(routeFiles.category),
    ].join("\n");
    const cart = source("app/(public)/cart/page.tsx");
    const checkout = source("app/(public)/checkout/page.tsx");
    const storefrontLock = source("lib/storefront/storefront-production-lock.ts");
    const checkoutLock = source("lib/marketplace-checkout/production-lock.ts");
    expect(sources).toContain("<ul");
    expect(sources).not.toMatch(/rating|review count|best seller|trending|only \d+ left|delivery time|sale countdown/i);
    expect(sources).not.toMatch(/Categories are not available for public browsing|Stores are not available for public browsing|Products are not available for public browsing/i);
    expect(cart).toContain('routeContext="cart"');
    expect(checkout).toContain('routeContext="checkout"');
    expect(storefrontLock).toContain("STOREFRONT_PRODUCTION_VALIDATION_APPROVED = false");
    expect(checkoutLock).toContain("MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false");
  });
});
