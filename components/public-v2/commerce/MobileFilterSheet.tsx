"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorefrontFilterInput, StorefrontSort } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontFacet } from "@/lib/storefront/storefront-types";
import { marketplaceListingHref, marketplaceHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import { MobileSheet } from "@/components/public-v2/overlays";
import styles from "./commerce.module.css";

interface MobileFilterSheetProps {
  facets: readonly StorefrontFacet[];
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
  resultCount: number;
}

function copyFilters(filters: StorefrontFilterInput): StorefrontFilterInput {
  return {
    ...filters,
    availability: filters.availability ? [...filters.availability] : undefined,
    condition: filters.condition ? [...filters.condition] : undefined,
    fulfilment: filters.fulfilment ? [...filters.fulfilment] : undefined,
    facets: Object.fromEntries(
      Object.entries(filters.facets ?? {}).map(([key, values]) => [key, [...values]])
    ),
  };
}

function isSelected(filters: StorefrontFilterInput, code: string, value: string): boolean {
  if (code === "category" || code === "store" || code === "brand") return filters[code] === value;
  if (code === "availability" || code === "condition" || code === "fulfilment") {
    return (filters[code] ?? []).includes(value);
  }
  return (filters.facets?.[code] ?? []).includes(value);
}

function toggleFilter(filters: StorefrontFilterInput, code: string, value: string): StorefrontFilterInput {
  const next = copyFilters(filters);
  if (code === "category" || code === "store" || code === "brand") {
    next[code] = next[code] === value ? undefined : value;
  } else if (code === "availability" || code === "condition" || code === "fulfilment") {
    const selected = new Set(next[code] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next[code] = [...selected];
  } else {
    const selected = new Set(next.facets?.[code] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next.facets = { ...(next.facets ?? {}), [code]: [...selected] };
  }
  next.cursor = undefined;
  next.page = undefined;
  return next;
}

function countActiveFilters(draft: StorefrontFilterInput, route: MarketplaceListingRoute): number {
  let count = 0;
  if (draft.minPrice || draft.maxPrice) count += 1;
  if (draft.sort && draft.sort !== "RELEVANCE") count += 1;
  if (draft.category && route.kind !== "category" && route.kind !== "store-category") count += 1;
  if (draft.store && route.kind !== "store" && route.kind !== "store-category") count += 1;
  if (draft.brand) count += 1;
  if (draft.availability?.length) count += draft.availability.length;
  if (draft.condition?.length) count += draft.condition.length;
  if (draft.fulfilment?.length) count += draft.fulfilment.length;
  for (const values of Object.values(draft.facets ?? {})) {
    count += values.length;
  }
  return count;
}

function getFacetSelectedCount(draft: StorefrontFilterInput, code: string): number {
  if (code === "category") return draft.category ? 1 : 0;
  if (code === "store") return draft.store ? 1 : 0;
  if (code === "brand") return draft.brand ? 1 : 0;
  if (code === "availability") return draft.availability?.length ?? 0;
  if (code === "condition") return draft.condition?.length ?? 0;
  if (code === "fulfilment") return draft.fulfilment?.length ?? 0;
  return draft.facets?.[code]?.length ?? 0;
}

const SORT_OPTIONS: Array<{ code: StorefrontSort; label: string }> = [
  { code: "RELEVANCE", label: "Relevance" },
  { code: "NEWEST", label: "Newest" },
  { code: "PRICE_ASC", label: "Price: Low to high" },
  { code: "PRICE_DESC", label: "Price: High to low" },
  { code: "NAME_ASC", label: "Name: A to Z" },
];

const PRICE_PRESETS: Array<{ label: string; min?: string; max?: string }> = [
  { label: "Under R250", min: undefined, max: "250" },
  { label: "R250 – R500", min: "250", max: "500" },
  { label: "R500 – R1000", min: "500", max: "1000" },
  { label: "R1000+", min: "1000", max: undefined },
];

export function MobileFilterSheet({ facets, filters, route, resultCount }: MobileFilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => copyFilters(filters));
  const [expandedFacets, setExpandedFacets] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    facets.forEach((facet, index) => {
      const hasSelected = facet.values.some((v) => isSelected(filters, facet.code, v.value));
      initial[facet.code] = hasSelected || index < 2;
    });
    return initial;
  });
  const [showAllFacets, setShowAllFacets] = useState<Record<string, boolean>>({});

  const openSheet = useCallback(() => {
    setDraft(copyFilters(filters));
    setOpen(true);
  }, [filters]);

  useEffect(() => {
    window.addEventListener("kt:open-filter-sheet", openSheet);
    return () => window.removeEventListener("kt:open-filter-sheet", openSheet);
  }, [openSheet]);

  const clearAll = () => {
    setDraft({
      ...(filters.q ? { q: filters.q } : {}),
      ...(route.kind === "store" || route.kind === "store-category" ? { store: route.storeSlug } : {}),
      ...(route.kind === "category" ? { category: route.categoryPath } : {}),
      ...(route.kind === "store-category" ? { category: route.categoryPath } : {}),
    });
  };

  const apply = () => {
    router.push(marketplaceListingHref(route, draft) ?? marketplaceHref());
    setOpen(false);
  };

  const toggleFacetExpanded = (code: string) => {
    setExpandedFacets((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleShowAll = (code: string) => {
    setShowAllFacets((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handlePresetClick = (min?: string, max?: string) => {
    setDraft((curr) => {
      const isCurrent = (curr.minPrice ?? undefined) === min && (curr.maxPrice ?? undefined) === max;
      if (isCurrent) {
        return { ...curr, minPrice: undefined, maxPrice: undefined };
      }
      return { ...curr, minPrice: min, maxPrice: max };
    });
  };

  const activeCount = countActiveFilters(draft, route);
  const appliedCount = countActiveFilters(filters, route);

  return (
    <>
      <div className={styles.mobileFilterTriggerBar}>
        <span className={styles.mobileFilterResultCount}>
          {resultCount} {resultCount === 1 ? "product" : "products"}
        </span>
        <button
          aria-expanded={open}
          className={styles.mobileFilterOpenButton}
          onClick={openSheet}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M4 7h16M7 12h10m-7 5h4" />
          </svg>
          <span>Filter & sort</span>
          {appliedCount > 0 && (
            <span className={styles.mobileFilterBadge}>{appliedCount}</span>
          )}
        </button>
      </div>

      <MobileSheet
        ariaLabel="Filter and sort products"
        className={styles.filterMobileSheetDialog}
        closeOnBackdropClick
        description="Choose filters, then apply them to the product list."
        onOpenChange={setOpen}
        open={open}
        title="Filter & sort"
      >
        <div className={styles.filterSheetTopBar}>
          <span>{activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} selected` : "No filters selected"}</span>
          {activeCount > 0 && (
            <button className={styles.filterResetButton} onClick={clearAll} type="button">
              Reset all
            </button>
          )}
        </div>

        <div className={styles.filterSheetBody}>
          {/* Segmented Sort Pills */}
          <section aria-labelledby="filter-sort-heading" className={styles.filterSortSection}>
            <h3 className={styles.filterSortHeading} id="filter-sort-heading">
              Sort by
            </h3>
            <div className={styles.filterSortPills} role="radiogroup">
              {SORT_OPTIONS.map((opt) => {
                const selected = (draft.sort ?? "RELEVANCE") === opt.code;
                return (
                  <button
                    aria-checked={selected}
                    className={styles.filterSortPill}
                    data-selected={selected ? "true" : undefined}
                    key={opt.code}
                    onClick={() =>
                      setDraft((curr) => ({
                        ...curr,
                        sort: opt.code === "RELEVANCE" ? undefined : opt.code,
                      }))
                    }
                    role="radio"
                    type="button"
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Price Range Section */}
          <section aria-labelledby="filter-price-heading" className={styles.filterPriceSection}>
            <h3 className={styles.filterPriceHeading} id="filter-price-heading">
              Price range · ZAR
            </h3>

            {/* Quick Price Presets */}
            <div className={styles.filterPricePills}>
              {PRICE_PRESETS.map((preset) => {
                const selected =
                  (draft.minPrice ?? undefined) === preset.min &&
                  (draft.maxPrice ?? undefined) === preset.max;
                return (
                  <button
                    aria-pressed={selected}
                    className={styles.filterPricePill}
                    data-selected={selected ? "true" : undefined}
                    key={preset.label}
                    onClick={() => handlePresetClick(preset.min, preset.max)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Price Inputs */}
            <div className={styles.filterPriceInputsRow}>
              <div className={styles.filterPriceInputWrapper}>
                <label className={styles.filterPriceInputLabel} htmlFor="mobile-min-price">
                  Minimum
                </label>
                <div className={styles.filterPriceInputBox}>
                  <span className={styles.filterPriceCurrencyPrefix}>R</span>
                  <input
                    aria-label="Minimum price in rand"
                    className={styles.filterPriceInputField}
                    id="mobile-min-price"
                    inputMode="decimal"
                    min="0"
                    onChange={(e) =>
                      setDraft((curr) => ({ ...curr, minPrice: e.target.value || undefined }))
                    }
                    placeholder="0"
                    type="number"
                    value={draft.minPrice ?? ""}
                  />
                </div>
              </div>

              <div className={styles.filterPriceInputWrapper}>
                <label className={styles.filterPriceInputLabel} htmlFor="mobile-max-price">
                  Maximum
                </label>
                <div className={styles.filterPriceInputBox}>
                  <span className={styles.filterPriceCurrencyPrefix}>R</span>
                  <input
                    aria-label="Maximum price in rand"
                    className={styles.filterPriceInputField}
                    id="mobile-max-price"
                    inputMode="decimal"
                    min="0"
                    onChange={(e) =>
                      setDraft((curr) => ({ ...curr, maxPrice: e.target.value || undefined }))
                    }
                    placeholder="Any"
                    type="number"
                    value={draft.maxPrice ?? ""}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Facets Accordion */}
          {facets.map((facet) => {
            const isExpanded = expandedFacets[facet.code] ?? false;
            const selectedCount = getFacetSelectedCount(draft, facet.code);
            const isShowingAll = showAllFacets[facet.code] ?? false;
            const displayValues = isShowingAll ? facet.values : facet.values.slice(0, 8);
            const hasMore = facet.values.length > 8;

            return (
              <section className={styles.facetAccordionSection} key={facet.code}>
                <button
                  aria-expanded={isExpanded}
                  className={styles.facetAccordionHeader}
                  onClick={() => toggleFacetExpanded(facet.code)}
                  type="button"
                >
                  <div className={styles.facetAccordionTitleGroup}>
                    <span className={styles.facetAccordionTitle}>{facet.label}</span>
                    {selectedCount > 0 && (
                      <span className={styles.facetSelectedCountBadge}>{selectedCount}</span>
                    )}
                  </div>
                  <svg
                    aria-hidden="true"
                    className={styles.facetChevronIcon}
                    data-expanded={isExpanded ? "true" : undefined}
                    fill="none"
                    height="16"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="16"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {isExpanded && (
                  <>
                    <ul className={styles.facetList}>
                      {displayValues.map((val) => {
                        const selected = isSelected(draft, facet.code, val.value);
                        return (
                          <li key={val.value}>
                            <button
                              aria-pressed={selected}
                              className={styles.facetChoiceButton}
                              onClick={() => setDraft((curr) => toggleFilter(curr, facet.code, val.value))}
                              type="button"
                            >
                              <span
                                aria-hidden="true"
                                className={styles.facetCheckbox}
                                data-checked={selected ? "true" : undefined}
                              >
                                {selected && (
                                  <svg
                                    fill="none"
                                    height="12"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2.5"
                                    viewBox="0 0 24 24"
                                    width="12"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </span>
                              <span className={styles.facetChoiceLabel}>{val.label}</span>
                              <span className={styles.facetChoiceCount}>{val.count}</span>
                            </button>
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
                        {isShowingAll
                          ? "− Show less"
                          : `+ Show ${facet.values.length - 8} more`}
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>

        <footer className={styles.filterSheetFooter}>
          <button className={styles.filterFooterResetButton} onClick={clearAll} type="button">
            Reset
          </button>
          <button className={styles.filterFooterApplyButton} onClick={apply} type="button">
            Show products
          </button>
        </footer>
      </MobileSheet>
    </>
  );
}
