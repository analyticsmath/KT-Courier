"use client";

import { useRouter } from "next/navigation";
import type { StorefrontFilterInput, StorefrontSort } from "@/lib/storefront/search/storefront-filter-url";
import { marketplaceListingHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

const sortLabels: Record<StorefrontSort, string> = {
  RELEVANCE: "Relevance",
  NEWEST: "Newest",
  PRICE_ASC: "Price: Low to High",
  PRICE_DESC: "Price: High to Low",
  NAME_ASC: "Name: A to Z",
};

const supportedSorts: StorefrontSort[] = [
  "RELEVANCE",
  "NEWEST",
  "PRICE_ASC",
  "PRICE_DESC",
  "NAME_ASC",
];

interface SortControlProps {
  route: MarketplaceListingRoute;
  filters: StorefrontFilterInput;
}

export function SortControl({ route, filters }: SortControlProps) {
  const router = useRouter();
  const currentSort = filters.sort ?? "RELEVANCE";

  const handleSortChange = (newSort: StorefrontSort) => {
    const next: StorefrontFilterInput = {
      ...filters,
      sort: newSort === "RELEVANCE" ? undefined : newSort,
      cursor: undefined,
      page: undefined,
    };
    router.push(marketplaceListingHref(route, next));
  };

  return (
    <div className={styles.sortControlWrapper}>
      <label
        className={styles.sortControlLabel}
        htmlFor="plp-sort-select"
      >
        Sort:
      </label>
      <select
        className={styles.sortControlSelect}
        id="plp-sort-select"
        onChange={(e) => handleSortChange(e.target.value as StorefrontSort)}
        value={currentSort}
      >
        {supportedSorts.map((sort) => (
          <option key={sort} value={sort}>
            {sortLabels[sort]}
          </option>
        ))}
      </select>
    </div>
  );
}
