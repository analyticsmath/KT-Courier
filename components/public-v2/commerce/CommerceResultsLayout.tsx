import type { ReactNode } from "react";
import Link from "next/link";
import type { StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontSearchResponse } from "@/lib/storefront/storefront-types";
import { type MarketplaceListingRoute, marketplaceHref } from "@/lib/public-marketplace/routes";
import { ProductGrid } from "./ProductGrid";
import { DesktopFilterRail } from "./DesktopFilterRail";
import { MobileFilterSheet } from "./MobileFilterSheet";
import { AppliedFilterBar } from "./AppliedFilterBar";
import { SortControl } from "./SortControl";
import styles from "./commerce.module.css";
import { CommerceBreadcrumbs } from "./CommerceBreadcrumbs";
import { listStorefrontCategories, getStorefrontFacetDisplayNames } from "@/lib/services/storefront-catalog.service";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface CommerceResultsLayoutProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  context?: ReactNode;
  result: StorefrontSearchResponse;
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
  retainedFilters?: Partial<StorefrontFilterInput>;
  emptyTitle?: string;
  emptyDescription?: string;
}

function titleCase(value: string) {
  return value.replace(/^\/+|\/+$/g, "").split(/[\/_-]+/).filter(Boolean).map((word) => word.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("en-ZA"))).join(" ") || "Browse";
}

function enumLabel(code: string, value: string) {
  if (code === "availability") return availabilityLabel(value as Parameters<typeof availabilityLabel>[0]);
  if (code === "fulfilment") return value === "COURIER_DELIVERY" ? "Courier delivery" : value === "STORE_PICKUP" ? "Store pickup" : value === "PICKUP_AND_DELIVERY" ? "Pickup and delivery" : titleCase(value);
  if (code === "condition") return ({ NEW: "New", REFURBISHED: "Refurbished", RECONDITIONED: "Reconditioned", USED: "Used" } as Record<string, string>)[value] ?? titleCase(value);
  return titleCase(value);
}

export async function CommerceResultsLayout({
  title,
  description,
  breadcrumbs = [{ label: "Shop", href: marketplaceHref() }],
  context,
  result,
  filters,
  route,
  retainedFilters = {},
  emptyTitle = "No products found",
  emptyDescription = "Try clearing filters or searching for a different keyword.",
}: CommerceResultsLayoutProps) {
  const brandReferences = [...new Set([
    ...result.facets.filter((facet) => facet.code === "brand").flatMap((facet) => facet.values.map((value) => value.value)),
    ...result.appliedFilters.filter((filter) => filter.code === "brand").map((filter) => filter.value),
  ])].slice(0, 20);
  const storeSlugs = [...new Set([
    ...result.facets.filter((facet) => facet.code === "store").flatMap((facet) => facet.values.map((value) => value.value)),
    ...result.appliedFilters.filter((filter) => filter.code === "store").map((filter) => filter.value),
  ])].slice(0, 20);
  const [categories, displayNames] = await Promise.all([
    listStorefrontCategories(),
    getStorefrontFacetDisplayNames({ storeSlugs, brandReferences }),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.path.startsWith("/") ? category.path : `/${category.path}`, category.name]));
  const storeNames = displayNames.stores;
  const brandNames = displayNames.brands;
  const labelFor = (code: string, value: string) => {
    if (code === "category") {
      const path = value.startsWith("/") ? value : `/${value}`;
      return categoryNames.get(path) ?? titleCase(value.split("/").filter(Boolean).at(-1) ?? value);
    }
    if (code === "store") return storeNames.get(value) ?? titleCase(value);
    if (code === "brand") return brandNames.get(value) ?? "Brand";
    return enumLabel(code, value);
  };
  const facets = result.facets.map((facet) => ({
    ...facet,
    label: facet.code === "category" ? "Category" : facet.code === "store" ? "Store" : facet.code === "brand" ? "Brand" : titleCase(facet.label),
    values: facet.values.map((value) => ({ ...value, label: labelFor(facet.code, value.value) })),
  }));
  const priceRange = [filters.minPrice, filters.maxPrice].some(Boolean)
    ? `${filters.minPrice ? `From ${new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(filters.minPrice))}` : ""}${filters.minPrice && filters.maxPrice ? " – " : ""}${filters.maxPrice ? `Up to ${new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(filters.maxPrice))}` : ""}`
    : null;
  const appliedFilters = [
    ...result.appliedFilters.map((filter) => ({
    ...filter,
    label: labelFor(filter.code, filter.value),
    })),
    ...(priceRange ? [{ code: "price", value: `${filters.minPrice ?? ""}:${filters.maxPrice ?? ""}`, label: priceRange }] : []),
  ];
  const scopedCodes = route.kind === "store" ? new Set(["store"]) : route.kind === "category" ? new Set(["category"]) : route.kind === "store-category" ? new Set(["store", "category"]) : new Set<string>();
  const visibleAppliedFilters = appliedFilters.filter((filter) => !scopedCodes.has(filter.code));
  const { results, resultCount } = result;

  return (
    <div className={styles.commerceInner}>
      {/* Breadcrumb Bar */}
      {breadcrumbs.length > 0 && <CommerceBreadcrumbs items={breadcrumbs} />}

      {/* Header & Title Plane */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 560, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
          {title}
        </h1>
        {description && (
          <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", maxWidth: 600, margin: 0 }}>
            {description}
          </p>
        )}
      </div>

      {/* Optional Context (e.g. Search Suggestions or Category Media) */}
      {context}

      {/* Utility Bar: Count & Sort (Desktop) */}
      <div className={styles.plpUtilityBar}>
        <span className={styles.plpUtilityCount}>
          {resultCount} {resultCount === 1 ? "product" : "products"}
        </span>

        <SortControl filters={filters} route={route} />
      </div>

      {/* Mobile Filter & Sort Drawer Trigger */}
      <MobileFilterSheet
        facets={facets}
        filters={filters}
        resultCount={resultCount}
        route={route}
      />

      {/* Applied Filter Tags */}
      <AppliedFilterBar
        appliedFilters={visibleAppliedFilters}
        filters={filters}
        retainedFilters={retainedFilters}
        route={route}
      />

      {/* Main Results Layout: Filter Rail + Product Grid */}
      <div className={styles.plpMainLayout}>
        <DesktopFilterRail facets={facets} filters={filters} route={route} />

        <div style={{ minWidth: 0 }}>
          {results.length > 0 ? (
            <ProductGrid label={title} products={results} />
          ) : (
            <div style={{ padding: "3rem 0" }}>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 560 }}>{emptyTitle}</h2>
              <p style={{ color: "var(--kt-muted, #5f6763)", margin: "8px 0 24px" }}>
                {emptyDescription}
              </p>
              <Link className={styles.sectionDirectLink} href={marketplaceHref()}>
                Return to shop &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
