import Link from "next/link";
import type { StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontSearchResponse } from "@/lib/storefront/storefront-types";
import { marketplaceListingHref, marketplaceHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import { KtIconClose } from "@/components/public-v2/graphics/KtIcons";
import styles from "./commerce.module.css";

type AppliedFilterItem = StorefrontSearchResponse["appliedFilters"][number];

interface AppliedFilterBarProps {
  appliedFilters: readonly AppliedFilterItem[];
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
  retainedFilters?: Partial<StorefrontFilterInput>;
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

function removeApplied(
  route: MarketplaceListingRoute,
  filters: StorefrontFilterInput,
  code: string,
  value: string
) {
  const next = copyFilters(filters);
  if (code === "category" || code === "store" || code === "brand") {
    next[code] = undefined;
  } else if (code === "availability" || code === "condition" || code === "fulfilment") {
    next[code] = (next[code] ?? []).filter((item) => item !== value);
  } else {
    next.facets = {
      ...(next.facets ?? {}),
      [code]: (next.facets?.[code] ?? []).filter((item) => item !== value),
    };
  }
  next.cursor = undefined;
  next.page = undefined;
  return marketplaceListingHref(route, next) ?? marketplaceHref();
}

function clearAllHref(
  route: MarketplaceListingRoute,
  filters: StorefrontFilterInput,
  retained: Partial<StorefrontFilterInput>
) {
  const cleared: StorefrontFilterInput = {
    ...retained,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.sort ? { sort: filters.sort } : {}),
  };
  return marketplaceListingHref(route, cleared) ?? marketplaceHref();
}

export function AppliedFilterBar({
  appliedFilters,
  filters,
  route,
  retainedFilters = {},
}: AppliedFilterBarProps) {
  if (!appliedFilters.length) return null;

  return (
    <div aria-label="Applied filters" className={styles.appliedFilterBar}>
      <span style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}>
        Filters:
      </span>

      {appliedFilters.map((applied) => {
        const removeHref = removeApplied(
          route,
          filters,
          applied.code,
          applied.value
        );

        return (
          <Link
            aria-label={`Remove filter ${applied.label}`}
            className={styles.appliedFilterTag}
            href={removeHref}
            key={`${applied.code}:${applied.value}`}
          >
            <span>{applied.label}</span>
            <KtIconClose size={14} />
          </Link>
        );
      })}

      <Link
        className={styles.clearAllFiltersLink}
        href={clearAllHref(route, filters, retainedFilters)}
      >
        Clear all
      </Link>
    </div>
  );
}
