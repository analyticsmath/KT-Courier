import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";

const root = process.cwd();
const routes = [
  "app/(admin)/admin/catalog/page.tsx",
  "app/(admin)/admin/catalog/categories/page.tsx",
  "app/(admin)/admin/catalog/product-types/page.tsx",
  "app/(admin)/admin/catalog/products/page.tsx",
  "app/(admin)/admin/catalog/products/[id]/page.tsx",
  "app/(admin)/admin/catalog/offers/page.tsx",
  "app/(admin)/admin/catalog/moderation/page.tsx",
  "app/(admin)/admin/catalog/moderation/[id]/page.tsx",
  "app/(admin)/admin/catalog/media/page.tsx",
  "app/(admin)/admin/catalog/media/[id]/page.tsx",
  "app/(admin)/admin/catalog/duplicates/page.tsx",
  "app/(admin)/admin/storefront/collections/page.tsx",
  "app/(admin)/admin/storefront/collections/[id]/page.tsx",
  "app/(admin)/admin/storefront/projections/page.tsx",
  "app/(admin)/admin/storefront/projections/[id]/page.tsx",
  "app/(admin)/admin/storefront/search-synonyms/page.tsx",
  "app/(admin)/admin/storefront/search-synonyms/[id]/page.tsx",
  "app/(admin)/admin/marketplace-checkout/page.tsx",
  "app/(admin)/admin/store-order-reconciliation/page.tsx",
] as const;
const source = (file: string) => readFileSync(join(root, file), "utf8");
const allRouteSource = routes.map(source).join("\n");

describe("R20 commerce operations closure", () => {
  it("keeps every concrete R20 commerce route present and protected-v2", () => {
    for (const route of routes) {
      expect(existsSync(join(root, route))).toBe(true);
      expect(source(route)).toContain("@/components/protected-v2/");
      expect(source(route)).toContain("ProtectedPageFrame");
    }
  });

  it("removes legacy page surfaces from the migrated route set", () => {
    expect(allRouteSource).not.toContain("@/components/ui/PageHeader");
    expect(allRouteSource).not.toContain("@/components/ui/Card");
    expect(allRouteSource).not.toMatch(/<PageHeader\b|<Card\b|<main\b/);
  });

  it("keeps checkout and storefront exposure truthful about production locks", () => {
    const checkout = source("app/(admin)/admin/marketplace-checkout/page.tsx");
    const storefront = routes.filter((route) => route.includes("/storefront/")).map(source).join("\n");
    expect(checkout).toContain('kind="locked"');
    expect(checkout).not.toMatch(/<button\b|<form\b|onClick=/);
    expect(storefront).toContain("storefrontPublicExposureAllowed");
    expect(source("components/protected-v2/commerce-admin/CommerceAdminActions.tsx")).toContain("publicExposureLocked");
  });

  it("uses canonical service DTOs and excludes unsafe catalog data from presentation", () => {
    const catalog = routes.filter((route) => route.includes("/catalog/") || route.endsWith("/catalog/page.tsx")).map(source).join("\n");
    expect(catalog).toContain("listCatalogAdminProducts");
    expect(catalog).toContain("listAdminCatalogMediaForPage");
    expect(catalog).not.toMatch(/storageKey|storageProvider|complianceValues|qualityScore|JSON\.stringify/);
    expect(catalog).not.toMatch(/fixture.*(?:product|category|media|offer)/i);
    expect(catalog).not.toMatch(/similarityScore|automaticMerge/);
  });

  it("maps known source states explicitly and leaves unknown states neutral", () => {
    expect(presentCommerceStatus("SUBMITTED")).toEqual({ label: "Submitted", tone: "information" });
    expect(presentCommerceStatus("QUARANTINED")).toEqual({ label: "Quarantined", tone: "warning" });
    expect(presentCommerceStatus("UNMAPPED_STATE")).toEqual({ label: "Status unavailable", tone: "neutral" });
  });

  it("keeps action eligibility server-authoritative without serializing permission keys", () => {
    const actionPages = [
      source("app/(admin)/admin/catalog/products/[id]/page.tsx"),
      source("app/(admin)/admin/catalog/media/[id]/page.tsx"),
      source("app/(admin)/admin/storefront/collections/[id]/page.tsx"),
      source("app/(admin)/admin/storefront/projections/[id]/page.tsx"),
      source("app/(admin)/admin/storefront/search-synonyms/[id]/page.tsx"),
    ].join("\n");
    expect(actionPages).toContain("hasPermission");
    expect(actionPages).toContain("requireAdminPagePermission");
    const actions = source("components/protected-v2/commerce-admin/CommerceAdminActions.tsx");
    expect(actions).not.toContain("PERMISSIONS.");
    expect(actions).not.toMatch(/tabIndex=\{?[1-9]/);
  });

  it("keeps store-order reconciliation operational and distinct from R21 finance work", () => {
    const reconciliation = source("app/(admin)/admin/store-order-reconciliation/page.tsx");
    expect(reconciliation).toContain("STORE_ORDERS_RECONCILE");
    expect(reconciliation).toContain("Marketplace store order");
    expect(reconciliation).not.toMatch(/refundId|adjustmentId|sellerBasis|commissionAmount|storeEarningAmount/i);
    expect(reconciliation).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/);
  });

  it("uses explicit compact-record table behavior and no prohibited commerce metrics", () => {
    expect(allRouteSource).toContain('mobileMode="stack"');
    expect(allRouteSource).not.toMatch(/revenue chart|marketplace growth|conversion-rate|traffic metric/i);
    expect(allRouteSource).not.toMatch(/gradient|glassmorphism|purple/i);
  });
});
