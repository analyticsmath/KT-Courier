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
  if (!facets.length) return null;

  return (
    <aside aria-label="Filters" className={styles.plpFilterSidebar}>
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
