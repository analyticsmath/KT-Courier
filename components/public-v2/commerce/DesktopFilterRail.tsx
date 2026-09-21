"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontFacet } from "@/lib/storefront/storefront-types";
import { marketplaceListingHref, marketplaceHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

interface DesktopFilterRailProps {
  facets: readonly StorefrontFacet[];
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
}

function copyFilters(filters: StorefrontFilterInput): StorefrontFilterInput {
  return {
    ...filters,
    availability: filters.availability ? [...filters.availability] : undefined,
    condition: filters.condition ? [...filters.condition] : undefined,
    fulfilment: filters.fulfilment ? [...filters.fulfilment] : undefined,
    facets: Object.fromEntries(
      Object.entries(filters.facets ?? {}).map(([key, value]) => [key, [...value]])
    ),
  };
}

function facetHref(
  route: MarketplaceListingRoute,
  filters: StorefrontFilterInput,
  code: string,
  value: string
) {
  const next = copyFilters(filters);
  const toggleList = (key: "availability" | "condition" | "fulfilment") => {
    const selected = new Set(next[key] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next[key] = [...selected];
  };

  if (code === "category" || code === "store" || code === "brand") {
    next[code] = next[code] === value ? undefined : value;
  } else if (code === "availability" || code === "condition" || code === "fulfilment") {
    toggleList(code);
  } else {
    const selected = new Set(next.facets?.[code] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next.facets = { ...(next.facets ?? {}), [code]: [...selected] };
  }
  next.cursor = undefined;
  next.page = undefined;
  return marketplaceListingHref(route, next) ?? marketplaceHref();
}

export function DesktopFilterRail({ facets, filters, route }: DesktopFilterRailProps) {
  const router = useRouter();
  const railRef = useRef<HTMLElement>(null);
  const [minPrice, setMinPrice] = useState(filters.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ?? "");
  const [showAllFacets, setShowAllFacets] = useState<Record<string, boolean>>({});

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: StorefrontFilterInput = {
      ...filters,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      cursor: undefined,
      page: undefined,
    };
    router.push(marketplaceListingHref(route, next) ?? marketplaceHref());
  };

  const toggleShowAll = (code: string) => {
    setShowAllFacets((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const hasActiveFilters = Boolean(
    filters.minPrice ||
    filters.maxPrice ||
    filters.brand ||
    (filters.availability && filters.availability.length > 0) ||
    (filters.condition && filters.condition.length > 0) ||
    (filters.fulfilment && filters.fulfilment.length > 0) ||
    (filters.facets && Object.values(filters.facets).some((v) => v && v.length > 0)) ||
    (filters.category && route.kind !== "category" && route.kind !== "store-category") ||
    (filters.store && route.kind !== "store" && route.kind !== "store-category")
  );

  const clearHref = marketplaceListingHref(route, {
    ...(filters.q ? { q: filters.q } : {}),
    ...(route.kind === "store" || route.kind === "store-category" ? { store: route.storeSlug } : {}),
    ...(route.kind === "category" ? { category: route.categoryPath } : {}),
    ...(route.kind === "store-category" ? { category: route.categoryPath } : {}),
  }) ?? marketplaceHref();

  useEffect(() => {
    const focusRail = () => {
      const rail = railRef.current;
      if (!rail) return;
      rail.scrollIntoView({ behavior: "smooth", block: "start" });
      rail.focus({ preventScroll: true });
      rail.dataset.focused = "true";
      window.setTimeout(() => { delete rail.dataset.focused; }, 1200);
    };
    window.addEventListener("kt:focus-desktop-filters", focusRail);
    return () => window.removeEventListener("kt:focus-desktop-filters", focusRail);
  }, []);

  return (
    <aside aria-label="Filters" className={styles.plpFilterSidebar} ref={railRef} tabIndex={-1}>
      <div className={styles.desktopFilterRailHeader}>Filters</div>
      {/* Facet Groups with Show More Cap */}
      {facets.map((facet) => {
        const isShowingAll = showAllFacets[facet.code] ?? false;
        const displayValues = isShowingAll ? facet.values : facet.values.slice(0, 7);
        const hasMore = facet.values.length > 7;

        return (
          <div className={styles.desktopFacetGroup} key={facet.code}>
            <h3 className={styles.desktopFacetHeading}>{facet.label}</h3>
            <ul className={styles.facetList}>
              {displayValues.map((val) => {
                const href = facetHref(route, filters, facet.code, val.value);
                return (
                  <li key={val.value}>
                    <Link
                      className={styles.desktopFacetRowLink}
                      data-selected={val.selected ? "true" : undefined}
                      href={href}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          aria-hidden="true"
                          className={styles.desktopFacetIndicator}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {val.label}
                        </span>
                      </span>
                      <span className={styles.facetCount}>{val.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {hasMore && (
              <button
                className={styles.facetShowMoreButton}
                onClick={() => toggleShowAll(facet.code)}
                type="button"
              >
                {isShowingAll ? "− Show less" : `+ Show ${facet.values.length - 7} more`}
              </button>
            )}
          </div>
        );
      })}

      {/* Price Range Filter Form */}
      <form className={styles.desktopPriceForm} onSubmit={handlePriceSubmit}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className={styles.desktopFacetHeading} style={{ marginBottom: 10 }}>
            Price range · ZAR
          </legend>
          <div className={styles.desktopPriceInputs}>
            <label className={styles.desktopPriceField}>
              <span>Minimum</span>
              <input
                aria-label="Minimum price in rand"
                inputMode="decimal"
                min="0"
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                type="number"
                value={minPrice}
              />
            </label>
            <label className={styles.desktopPriceField}>
              <span>Maximum</span>
              <input
                aria-label="Maximum price in rand"
                inputMode="decimal"
                min="0"
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Any"
                type="number"
                value={maxPrice}
              />
            </label>
          </div>
          <button className={styles.desktopPriceApply} style={{ marginTop: 10, width: "100%" }} type="submit">
            Apply price
          </button>
        </fieldset>
      </form>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <div style={{ paddingTop: 4 }}>
          <Link className={styles.clearAllFiltersLink} href={clearHref} style={{ marginLeft: 0 }}>
            Clear all filters
          </Link>
        </div>
      )}
    </aside>
  );
}
