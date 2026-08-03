import { storefrontFilterHasCrawlRisk, type StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";

export function storefrontRobotsForFilters(filters: StorefrontFilterInput, preview = false): { index: boolean; follow: boolean } {
  if (preview || storefrontFilterHasCrawlRisk(filters)) return { index: false, follow: true };
  return { index: true, follow: true };
}

export const STOREFRONT_QUERY_ROBOTS = { index: false, follow: true } as const;

