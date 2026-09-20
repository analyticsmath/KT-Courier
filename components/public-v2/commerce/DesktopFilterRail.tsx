import Link from "next/link";
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
  const hiddenFilters: Array<{ name: string; value: string }> = [];
  if (filters.q) hiddenFilters.push({ name: "q", value: filters.q });
  if (filters.category && route.kind !== "category" && route.kind !== "store-category") hiddenFilters.push({ name: "category", value: filters.category });
  if (filters.store && route.kind !== "store" && route.kind !== "store-category") hiddenFilters.push({ name: "store", value: filters.store });
  if (filters.brand) hiddenFilters.push({ name: "brand", value: filters.brand });
  if (filters.sort) hiddenFilters.push({ name: "sort", value: filters.sort });
  for (const code of ["availability", "condition", "fulfilment"] as const) {
    if (filters[code]?.length) hiddenFilters.push({ name: code, value: filters[code]!.join(",") });
  }
  for (const [code, values] of Object.entries(filters.facets ?? {})) {
    if (values.length) hiddenFilters.push({ name: `f.${code}`, value: values.join(",") });
  }

  return (
    <aside aria-label="Filters" className={styles.plpFilterSidebar}>
      <form action={marketplaceListingHref(route, {})} className={styles.desktopPriceForm} method="get">
        {hiddenFilters.map((field) => <input key={field.name} name={field.name} type="hidden" value={field.value} />)}
        <fieldset>
          <legend className={styles.facetHeading}>Price range · ZAR</legend>
          <div className={styles.desktopPriceInputs}>
            <label className={styles.desktopPriceField}>Minimum<input inputMode="decimal" min="0" name="minPrice" type="number" defaultValue={filters.minPrice ?? ""} /></label>
            <label className={styles.desktopPriceField}>Maximum<input inputMode="decimal" min="0" name="maxPrice" type="number" defaultValue={filters.maxPrice ?? ""} /></label>
          </div>
          <button className={styles.desktopPriceApply} type="submit">Apply price</button>
        </fieldset>
      </form>
      {facets.map((facet) => (
        <div className={styles.facetGroup} key={facet.code}>
          <h3 className={styles.facetHeading}>{facet.label}</h3>
          <ul className={styles.facetList}>
            {facet.values.map((val: { value: string; label: string; count: number; selected: boolean }) => {
              const href = facetHref(route, filters, facet.code, val.value);
              return (
                <li key={val.value}>
                  <Link
                    className={styles.facetRowLink}
                    data-selected={val.selected ? "true" : undefined}
                    href={href}
                  >
                    <span>{val.label}</span>
                    <span className={styles.facetCount}>{val.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
