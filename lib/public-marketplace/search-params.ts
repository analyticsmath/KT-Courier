import { parseStorefrontFilters } from "@/lib/storefront/search/storefront-filter-url";

export type MarketplaceSearchParams = Record<string, string | string[] | undefined>;

/** Converts App Router search params without dropping repeated canonical filter values. */
export function parseMarketplaceSearchParams(input: MarketplaceSearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
  }
  return parseStorefrontFilters(params);
}
