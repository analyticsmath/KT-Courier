import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("R23 public marketplace experience", () => {
  it("uses public loaders and keeps list filters, sorting, and pagination server-authoritative", () => {
    const routes = [
      "app/(public)/shop/page.tsx",
      "app/(public)/shop/stores/page.tsx",
      "app/(public)/shop/categories/[...categoryPath]/page.tsx",
      "app/(public)/shop/search/page.tsx",
      "app/(public)/shop/products/[product]/page.tsx",
    ].map(source).join("\n");
    const results = source("components/public-v2/marketplace/MarketplaceResults.tsx");

    expect(routes).toContain("getStorefrontHome");
    expect(routes).toContain("StorefrontSearchService");
    expect(routes).not.toContain("storefrontPublicExposureAllowed");
    expect(results).toContain("marketplaceListingHref");
    expect(results).toContain("nextCursor");
    expect(results).toContain("Filter results");
    expect(results).not.toContain('"use client"');
  });

  it("keeps homepage and public navigation marketplace links canonical", () => {
    const hero = source("components/public-v2/home/HeroCommandDock.tsx");
    const homepage = source("components/public-v2/home/MarketplacePreview.tsx");
    const navigation = source("components/public-v2/site/PublicNavigation.tsx");
    expect(hero).toContain('href="/account/request-delivery"');
    expect(hero).toContain("marketplaceHref");
    expect(hero).toContain("anonymousTracking");
    expect(homepage).toContain("marketplaceHref");
    expect(navigation).toContain("marketplaceHref");
  });

  it("uses truthful SEO and source-unavailable handling without turning a valid record into a generic unavailable page", () => {
    const category = source("app/(public)/shop/categories/[...categoryPath]/page.tsx");
    const store = source("app/(public)/shop/stores/[storeSlug]/page.tsx");
    const product = source("app/(public)/shop/products/[product]/page.tsx");
    const sitemap = source("app/(public)/shop/sitemap.ts");
    const error = source("app/(public)/shop/error.tsx");

    for (const page of [category, store, product]) {
      expect(page).toContain("generateMetadata");
      expect(page).toContain("alternates");
      expect(page).not.toContain("MarketplaceUnavailable");
    }
    expect(product).toContain("storefrontProductGroupJsonLd");
    expect(sitemap).not.toContain("storefrontPublicExposureAllowed");
    expect(error).toContain("Marketplace source unavailable");
  });

  it("preserves production locks only at cart and checkout boundaries", () => {
    const storefrontLock = source("lib/storefront/storefront-production-lock.ts");
    const checkoutLock = source("lib/marketplace-checkout/production-lock.ts");
    const cart = source("app/(public)/cart/page.tsx");
    const checkout = source("app/(public)/checkout/page.tsx");
    expect(storefrontLock).toContain("STOREFRONT_PRODUCTION_VALIDATION_APPROVED = false");
    expect(checkoutLock).toContain("MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false");
    expect(cart).toContain("MarketplaceUnavailable");
    expect(checkout).toContain("MarketplaceUnavailable");
  });
});
