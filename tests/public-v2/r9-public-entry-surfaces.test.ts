import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { allR9EntryMedia } from "@/lib/public-assets/r9-entry-media";
import { participationRegistry } from "@/lib/public-participation/participation-registry";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("R9 public marketplace, participation, and developer entry surfaces", () => {
  it("keeps the storefront lock unchanged while R23 activates source-backed marketplace presentation", () => {
    const lock = read("lib/storefront/storefront-production-lock.ts");
    const shop = read("app/(public)/shop/page.tsx");
    const search = read("app/(public)/shop/search/page.tsx");
    const roots = [
      "app/(public)/shop/categories/page.tsx",
      "app/(public)/shop/stores/page.tsx",
      "app/(public)/shop/collections/page.tsx",
    ].map(read).join("\n");

    expect(lock).toContain("STOREFRONT_PRODUCTION_VALIDATION_APPROVED = false");
    expect(lock).not.toContain("process.env");
    expect(shop).toContain("getStorefrontHome");
    expect(shop).toContain("MarketplaceLanding");
    expect(search).toContain("StorefrontSearchService");
    expect(roots).not.toContain("MarketplaceUnavailable");
    expect(roots).not.toMatch(/Cape Pantry|Joburg Urban Eats|Natal Wellness|Karoo Craft|active offers|rating/i);
    expect(existsSync(path.join(root, "app/(public)/shop/search/SearchPanel.tsx"))).toBe(false);
  });

  it("keeps descendant publication resolution specific and uses not-found rather than a generic browse lock", () => {
    const descendants = [
      "app/(public)/shop/categories/[...categoryPath]/page.tsx",
      "app/(public)/shop/stores/[storeSlug]/page.tsx",
      "app/(public)/shop/products/[product]/page.tsx",
      "app/(public)/shop/products/[product]/[variantReference]/page.tsx",
      "app/(public)/shop/collections/[collectionSlug]/page.tsx",
    ].map(read);

    for (const source of descendants) {
      expect(source).toContain("notFound");
      expect(source).not.toContain("storefrontPublicExposureAllowed");
      expect(source).not.toContain("MarketplaceUnavailable");
    }
  });

  it("uses canonical owner-scoped delivery tracking on order confirmation while cart and checkout remain unavailable", () => {
    const cart = read("app/(public)/cart/page.tsx");
    const checkout = read("app/(public)/checkout/page.tsx");
    const confirmation = read("app/(public)/order-confirmation/[publicReference]/page.tsx");

    for (const source of [cart, checkout, confirmation]) {
      expect(source).toContain("robots: { index: false, follow: true }");
    }

    for (const source of [cart, checkout]) {
      expect(source).toContain("MarketplaceUnavailable");
    }

    expect(cart).not.toMatch(/Continue to checkout|total|fixture|localStorage/i);
    expect(checkout).not.toMatch(/payment|PayFast|address|form/i);

    expect(confirmation).toContain("publicReference");
    expect(confirmation).toContain("getMarketplaceDeliveryTracking");
    expect(confirmation).toContain("MARKETPLACE_ORDER_COOKIE");
    expect(confirmation).toContain("MarketplaceUnavailable");
    expect(confirmation).toContain("approximate");
    expect(confirmation).not.toMatch(/payment successful|localStorage|clientConfirmation/i);
    expect(confirmation).not.toMatch(/driverPhone|driverLicense|fullLocationHistory/i);
  });

  it("uses only verified participation actions and excludes earnings or requirement promises", () => {
    expect(participationRegistry.STORE.primaryAction.href).toBe("/signup?role=store");
    expect(participationRegistry.DRIVER.primaryAction.href).toBe("/services/driver-network");
    expect(participationRegistry.PROMOTER.primaryAction.href).toBe("/contact");

    const source = `${read("lib/public-participation/participation-registry.ts")}\n${read("components/public-v2/participation/ParticipationPage.tsx")}`;
    expect(source).not.toMatch(/guaranteed (?:earnings|work|acceptance|referrals)|commission percentage|approval time|licence categories|insurance requirements/i);
    expect(source).not.toMatch(/fraud signal|risk score|payout destination|tax verification/i);
    expect(read("app/(public)/join/page.tsx")).toContain('canonical: "/join"');
  });

  it("keeps developer entry documentation-led and points to the canonical OpenAPI resource", () => {
    const developerPage = read("components/public-v2/developers/DeveloperOverviewPage.tsx");
    const developerRoute = read("app/(account)/developers/page.tsx");
    const openApiRoute = read("app/api/openapi/v1.json/route.ts");

    expect(developerPage).toContain("DEVELOPER_SCOPES");
    expect(developerPage).toContain("PUBLIC_API_ROUTE_MANIFEST");
    expect(developerPage).toContain('href="/api/openapi/v1.json"');
    expect(developerPage).toContain("Content-Digest");
    expect(developerPage).not.toMatch(/try it|live api console|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]/i);
    expect(developerRoute).toContain("DeveloperOverviewPage");
    expect(developerRoute).toContain('route: "/developers"');
    expect(openApiRoute).toContain("openApiJson()");
  });

  it("keeps R9 media local, provisional, editorial-only, and documented", () => {
    expect(allR9EntryMedia).toHaveLength(6);
    for (const media of allR9EntryMedia) {
      expect(media.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(media.src).not.toMatch(/^https?:\/\//);
      expect(media.provisional).toBe(true);
      expect(media.editorialOnly).toBe(true);
      expect(media.sourceLedgerReference).toMatch(/^#/);
      expect(media.visibleBrandReview).not.toBe("");
      expect(existsSync(path.join(root, "public", media.src))).toBe(true);
    }
  });

  it("indexes only approved public R9 entry pages", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const route of ["/shop", "/join", "/developers"]) expect(urls).toContain(`https://ktcouriers.com${route}`);
    expect(urls.some((url) => /\/(?:cart|checkout|order-confirmation|account|store|admin|developers\/)/.test(url))).toBe(false);
  });

  it("keeps R9 presentation server-first, responsive, and accessible", () => {
    const sources = [
      "components/public-v2/marketplace/MarketplaceUnavailable.tsx",
      "components/public-v2/participation/ParticipationPage.tsx",
      "components/public-v2/developers/DeveloperOverviewPage.tsx",
    ].map(read).join("\n");
    const breadcrumb = read("components/public-v2/navigation/PublicBreadcrumbs.tsx");
    const css = [
      "components/public-v2/marketplace/marketplace.module.css",
      "components/public-v2/participation/participation.module.css",
      "components/public-v2/developers/developers.module.css",
    ].map(read).join("\n");

    expect(sources).not.toContain('"use client"');
    expect(breadcrumb).toContain('aria-label="Breadcrumb"');
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("forced-colors");
    expect(css).not.toMatch(/linear-gradient|radial-gradient|conic-gradient|purple|glassmorphism/i);
  });
});
