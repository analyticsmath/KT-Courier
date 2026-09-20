"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";
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
  return { ...filters, availability: filters.availability ? [...filters.availability] : undefined, condition: filters.condition ? [...filters.condition] : undefined, fulfilment: filters.fulfilment ? [...filters.fulfilment] : undefined, facets: Object.fromEntries(Object.entries(filters.facets ?? {}).map(([key, values]) => [key, [...values]])) };
}

function isSelected(filters: StorefrontFilterInput, code: string, value: string) {
  if (code === "category" || code === "store" || code === "brand") return filters[code] === value;
  if (code === "availability" || code === "condition" || code === "fulfilment") return (filters[code] ?? []).includes(value);
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

export function MobileFilterSheet({ facets, filters, route, resultCount }: MobileFilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => copyFilters(filters));
  const openSheet = useCallback(() => {
    setDraft(copyFilters(filters));
    setOpen(true);
  }, [filters]);

  useEffect(() => {
    window.addEventListener("kt:open-filter-sheet", openSheet);
    return () => window.removeEventListener("kt:open-filter-sheet", openSheet);
  }, [openSheet]);

  const clearAll = () => setDraft({ ...(filters.q ? { q: filters.q } : {}), ...(filters.sort ? { sort: filters.sort } : {}), ...(route.kind === "store" || route.kind === "store-category" ? { store: route.storeSlug } : {}), ...(route.kind === "category" ? { category: route.categoryPath } : {}), ...(route.kind === "store-category" ? { category: route.categoryPath } : {}) });
  const apply = () => {
    router.push(marketplaceListingHref(route, draft) ?? marketplaceHref());
    setOpen(false);
  };

  return <>
    <div className={styles.mobileFilterTriggerBar}>
      <span className={styles.mobileFilterResultCount}>{resultCount} {resultCount === 1 ? "product" : "products"}</span>
      <button aria-expanded={open} className={styles.mobileFilterOpenButton} onClick={openSheet} type="button">
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16"><path d="M4 7h16M7 12h10m-7 5h4"/></svg>
        <span>Filter & sort</span>
      </button>
    </div>
    <MobileSheet ariaLabel="Filter and sort products" closeOnBackdropClick description="Choose filters, then apply them to the product list." onOpenChange={setOpen} open={open} title="Filter & sort">
      <div className={styles.filterSheetBody}>
        <section className={styles.facetGroup}>
          <h3 className={styles.facetHeading}>Price range · ZAR</h3>
          <div className={styles.filterPriceFields}>
            <label>Minimum<input aria-label="Minimum price in rand" inputMode="decimal" min="0" onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value || undefined }))} type="number" value={draft.minPrice ?? ""} /></label>
            <label>Maximum<input aria-label="Maximum price in rand" inputMode="decimal" min="0" onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value || undefined }))} type="number" value={draft.maxPrice ?? ""} /></label>
          </div>
        </section>
        {facets.map((facet) => <section className={styles.facetGroup} key={facet.code}>
          <h3 className={styles.facetHeading}>{facet.label}</h3>
          <ul className={styles.facetList}>{facet.values.map((value) => {
            const selected = isSelected(draft, facet.code, value.value);
            return <li key={value.value}><button aria-pressed={selected} className={styles.filterChoice} onClick={() => setDraft((current) => toggleFilter(current, facet.code, value.value))} type="button"><span className={styles.filterCheckbox} aria-hidden="true">{selected ? "✓" : ""}</span><span>{value.label}</span><span className={styles.facetCount}>{value.count}</span></button></li>;
          })}</ul>
        </section>)}
        <label className={styles.filterSortRow}>Sort by<select onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value === "RELEVANCE" ? undefined : event.target.value as StorefrontFilterInput["sort"] }))} value={draft.sort ?? "RELEVANCE"}><option value="RELEVANCE">Relevance</option><option value="NEWEST">Newest</option><option value="PRICE_ASC">Price: low to high</option><option value="PRICE_DESC">Price: high to low</option><option value="NAME_ASC">Name: A to Z</option></select></label>
      </div>
      <footer className={styles.filterSheetFooter}>
        <button className={styles.filterClearButton} onClick={clearAll} type="button">Clear all</button>
        <button className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} onClick={apply} type="button">Show products</button>
      </footer>
    </MobileSheet>
  </>;
}
