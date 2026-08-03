export const STOREFRONT_CACHE_TAGS = {
  product: (reference: string) => `storefront:product:${reference}`,
  variant: (reference: string) => `storefront:variant:${reference}`,
  category: (reference: string) => `storefront:category:${reference}`,
  store: (reference: string) => `storefront:store:${reference}`,
  collection: (reference: string) => `storefront:collection:${reference}`,
  searchIndex: (version: string) => `storefront:search-index:${version}`,
} as const;

export function storefrontPublicCacheHeaders(): Record<string, string> {
  return { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
}

export function storefrontPrivateCacheHeaders(): Record<string, string> {
  return { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
}

export function isSafeStorefrontCacheArea(reference: string | null | undefined): boolean {
  return !reference || /^[a-z0-9][a-z0-9-]{0,95}$/.test(reference);
}

