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

export function CommerceResultsLayout({
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
  const { results, facets, appliedFilters, resultCount } = result;

  return (
    <div className={styles.commerceInner}>
      {/* Breadcrumb Bar */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "0.85rem",
            color: "var(--kt-muted, #5f6763)",
            padding: "1.5rem 0 1rem",
          }}
        >
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.label}>
              {idx > 0 && " / "}
              {crumb.href ? (
                <Link href={crumb.href} style={{ color: "inherit", textDecoration: "none" }}>
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

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

      {/* Utility Bar: Count & Sort */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 16,
          borderBottom: "1px solid var(--kt-cool-200, #dde1e0)",
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: "0.9rem", color: "var(--kt-graphite, #303532)" }}>
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
        appliedFilters={appliedFilters}
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
