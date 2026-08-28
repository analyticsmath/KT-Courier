"use client";

import { useRouter } from "next/navigation";
import type { StorefrontFilterInput, StorefrontSort } from "@/lib/storefront/search/storefront-filter-url";
import { marketplaceListingHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";

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
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <label
        htmlFor="plp-sort-select"
        style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}
      >
        Sort:
      </label>
      <select
        id="plp-sort-select"
        onChange={(e) => handleSortChange(e.target.value as StorefrontSort)}
        style={{
          padding: "6px 12px",
          border: "1px solid var(--kt-cool-300, #c9cecc)",
          backgroundColor: "var(--kt-white, #ffffff)",
          color: "var(--kt-carbon, #101210)",
          fontFamily: "inherit",
          fontSize: "0.85rem",
          cursor: "pointer",
          outline: "none",
        }}
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
