import Link from "next/link";
import type { StorefrontFilterInput, StorefrontSort } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontSearchResponse } from "@/lib/storefront/storefront-types";
import { marketplaceCategoriesHref, marketplaceListingHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import { MarketplaceCategoryRail, MarketplaceProductGrid, MarketplaceSearchForm, MarketplaceStoreGrid, type MarketplaceCategory, type MarketplaceStore } from "./MarketplaceCards";
import styles from "./market-hall.module.css";

const sortLabels: Record<StorefrontSort, string> = {
  RELEVANCE: "Relevance",
  NEWEST: "Newest",
  PRICE_ASC: "Price: low to high",
  PRICE_DESC: "Price: high to low",
  NAME_ASC: "Name: A to Z",
};
const supportedSorts: StorefrontSort[] = ["RELEVANCE", "NEWEST", "PRICE_ASC", "PRICE_DESC", "NAME_ASC"];

function copyFilters(filters: StorefrontFilterInput): StorefrontFilterInput {
  return { ...filters, availability: filters.availability ? [...filters.availability] : undefined, condition: filters.condition ? [...filters.condition] : undefined, fulfilment: filters.fulfilment ? [...filters.fulfilment] : undefined, facets: Object.fromEntries(Object.entries(filters.facets ?? {}).map(([key, value]) => [key, [...value]])) };
}

function href(route: MarketplaceListingRoute, filters: StorefrontFilterInput) {
  return marketplaceListingHref(route, filters);
}

function facetHref(route: MarketplaceListingRoute, filters: StorefrontFilterInput, code: string, value: string) {
  const next = copyFilters(filters);
  const toggleList = (key: "availability" | "condition" | "fulfilment") => {
    const selected = new Set(next[key] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next[key] = [...selected];
  };
  if (code === "category" || code === "store" || code === "brand") next[code] = next[code] === value ? undefined : value;
  else if (code === "availability" || code === "condition" || code === "fulfilment") toggleList(code);
  else {
    const selected = new Set(next.facets?.[code] ?? []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    next.facets = { ...(next.facets ?? {}), [code]: [...selected] };
  }
  next.cursor = undefined;
  next.page = undefined;
  return href(route, next);
}

function removeApplied(route: MarketplaceListingRoute, filters: StorefrontFilterInput, code: string, value: string) {
  const next = copyFilters(filters);
  if (code === "category" || code === "store" || code === "brand") next[code] = undefined;
  else if (code === "availability" || code === "condition" || code === "fulfilment") next[code] = (next[code] ?? []).filter((item) => item !== value);
  else next.facets = { ...(next.facets ?? {}), [code]: (next.facets?.[code] ?? []).filter((item) => item !== value) };
  next.cursor = undefined;
  next.page = undefined;
  return href(route, next);
}

function clearFilters(filters: StorefrontFilterInput, retained: Partial<StorefrontFilterInput>) {
  return { ...retained, ...(filters.q ? { q: filters.q } : {}), ...(filters.sort ? { sort: filters.sort } : {}) };
}

export function MarketplaceSearchDiscovery({ categories, stores }: { categories: readonly MarketplaceCategory[]; stores: readonly MarketplaceStore[] }) {
  if (!categories.length && !stores.length) return null;
  return (
    <section aria-label="Matching marketplace records" className={styles.searchDiscovery}>
      <p className={styles.eyebrow}>Matching marketplace records</p>
      {categories.length ? <div><h2 className={styles.contextHeading}>Categories</h2><MarketplaceCategoryRail categories={categories} label="Matching categories" /></div> : null}
      {stores.length ? <div><h2 className={styles.contextHeading}>Stores</h2><MarketplaceStoreGrid label="Matching stores" stores={stores} /></div> : null}
    </section>
  );
}

export function MarketplaceResults({ title, description, result, filters, route, retainedFilters = {}, breadcrumbs = [], context, emptyTitle = "No matching products", emptyDescription }: {
  title: string;
  description?: string;
  result: StorefrontSearchResponse;
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
  retainedFilters?: Partial<StorefrontFilterInput>;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  context?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const currentSort = filters.sort ?? (filters.q ? "RELEVANCE" : "NEWEST");
  const filtersPresent = result.appliedFilters.length > 0;

  return (
    <main className={`${styles.page} ${styles.listing}`} id="storefront-content">
      <div className={styles.inner}>
        {breadcrumbs.length ? <nav aria-label="Breadcrumb" className={styles.breadcrumb}>{breadcrumbs.map((item, index) => <span key={`${item.label}:${index}`}>{index ? " / " : ""}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav> : null}
        <div className={styles.listingHeading}>
          <p className={styles.eyebrow}>Marketplace discovery</p>
          <h1>{title}</h1>
          {description ? <p className={styles.listingDescription}>{description}</p> : null}
          <MarketplaceSearchForm action={marketplaceListingHref(route)} query={filters.q ?? ""} />
        </div>

        {context}

        <div className={styles.resultBar}>
          <p aria-live="polite">{result.resultCount} {result.resultCount === 1 ? "product" : "products"} found</p>
          <details className={styles.filterPanel}>
            <summary className={styles.filterToggle}>Filter results</summary>
            <div className={styles.facetGroups}>
              {result.facets.map((facet) => (
                <section className={styles.facetGroup} key={facet.code}>
                  <h2>{facet.label}</h2>
                  {facet.values.map((value) => <Link className={styles.facetLink} data-selected={value.selected || undefined} href={facetHref(route, filters, facet.code, value.value)} key={value.value}><span>{value.label}</span><span>{value.count}</span></Link>)}
                </section>
              ))}
            </div>
          </details>
        </div>

        <div className={styles.sortList} aria-label="Sort products">
          {supportedSorts.map((sort) => <Link className={styles.sortLink} data-current={currentSort === sort || undefined} href={href(route, { ...filters, sort, cursor: undefined, page: undefined })} key={sort}>{sortLabels[sort]}</Link>)}
        </div>

        {filtersPresent ? <div className={styles.appliedFilters} aria-label="Applied filters">{result.appliedFilters.map((filter) => {
          const retained = filter.code in retainedFilters && (retainedFilters as Record<string, unknown>)[filter.code] === filter.value;
          return retained ? <span key={`${filter.code}:${filter.value}`}>{filter.label}</span> : <Link href={removeApplied(route, filters, filter.code, filter.value)} key={`${filter.code}:${filter.value}`}>Remove {filter.label}</Link>;
        })}<Link className={styles.clearLink} href={href(route, clearFilters(filters, retainedFilters))}>Clear filters</Link></div> : null}

        {result.results.length ? <MarketplaceProductGrid label="Marketplace products" products={result.results} /> : <section className={styles.empty} aria-labelledby="marketplace-no-results"><h2 id="marketplace-no-results">{emptyTitle}</h2><p>{emptyDescription ?? (result.noResultState === "FILTERS_TOO_RESTRICTIVE" ? "Try removing a filter or browse another category." : "Try a different search, or browse the marketplace categories.")}</p><Link className={styles.textLink} href={filtersPresent ? href(route, clearFilters(filters, retainedFilters)) : marketplaceCategoriesHref()}>{filtersPresent ? "Clear filters" : "Browse categories"}</Link></section>}

        {result.nextCursor ? <div className={styles.pagination}><Link className={styles.primaryLink} href={href(route, { ...filters, page: undefined, cursor: result.nextCursor })}>Next products</Link></div> : null}
      </div>
    </main>
  );
}
