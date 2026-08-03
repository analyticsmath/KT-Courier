import { canonicalStorefrontQuery, type StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";

const SLUG_SEGMENT = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/;
const PUBLIC_REFERENCE = /^[A-Z][A-Z0-9]{0,15}(?:-[A-Z0-9]+){1,16}$/;

export type MarketplaceListingRoute =
  | { kind: "search" }
  | { kind: "category"; categoryPath: string }
  | { kind: "store"; storeSlug: string }
  | { kind: "store-category"; storeSlug: string; categoryPath: string };

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function marketplaceSlug(value: string): string | null {
  const slug = value.toLocaleLowerCase("en-ZA").trim();
  return SLUG_SEGMENT.test(slug) ? slug : null;
}

export function marketplacePublicReference(value: string): string | null {
  const reference = value.trim();
  return PUBLIC_REFERENCE.test(reference) ? reference : null;
}

export function marketplaceCategoryPath(value: string | readonly string[]): string | null {
  const rawSegments = (typeof value === "string" ? value.split("/") : [...value]).filter((segment) => Boolean(segment && segment.trim()));
  if (!rawSegments.length || rawSegments.length > 12) return null;
  const segments = rawSegments.map(marketplaceSlug);
  return segments.every((segment): segment is string => Boolean(segment)) ? segments.join("/") : null;
}

export function marketplaceProductParameter(productSlug: string, productReference: string): string | null {
  const slug = marketplaceSlug(productSlug);
  const reference = marketplacePublicReference(productReference);
  return slug && reference?.startsWith("CP-") ? `${slug}-${reference}` : null;
}

export function parseMarketplaceProductParameter(value: string): { slug: string; reference: string } | null {
  const match = value.match(/^(.*)-(CP-[A-Z0-9]+(?:-[A-Z0-9]+)*)$/);
  if (!match?.[1] || !match[2]) return null;
  const slug = marketplaceSlug(match[1]);
  const reference = marketplacePublicReference(match[2]);
  return slug && reference?.startsWith("CP-") ? { slug, reference } : null;
}

export function marketplaceHref(): string {
  return "/shop";
}

export function marketplaceCategoriesHref(): string {
  return "/shop/categories";
}

export function marketplaceCategoryHref(path: string): string | null {
  const safePath = marketplaceCategoryPath(path);
  return safePath ? `/shop/categories/${safePath.split("/").map(encodeSegment).join("/")}` : null;
}

export function marketplaceStoresHref(query?: string): string {
  const value = query?.trim().slice(0, 80);
  return value ? `/shop/stores?q=${encodeURIComponent(value)}` : "/shop/stores";
}

export function marketplaceStoreHref(slug: string): string | null {
  const safeSlug = marketplaceSlug(slug);
  return safeSlug ? `/shop/stores/${encodeSegment(safeSlug)}` : null;
}

export function marketplaceStoreCategoryHref(storeSlug: string, categoryPath: string): string | null {
  const store = marketplaceSlug(storeSlug);
  const category = marketplaceCategoryPath(categoryPath);
  return store && category ? `/shop/stores/${encodeSegment(store)}/categories/${category.split("/").map(encodeSegment).join("/")}` : null;
}

export function marketplaceProductHref(productSlug: string, productReference: string): string | null {
  const parameter = marketplaceProductParameter(productSlug, productReference);
  return parameter ? `/shop/products/${encodeSegment(parameter)}` : null;
}

export function marketplaceVariantHref(productSlug: string, productReference: string, variantReference: string): string | null {
  const productHref = marketplaceProductHref(productSlug, productReference);
  const variant = marketplacePublicReference(variantReference);
  return productHref && variant ? `${productHref}/${encodeSegment(variant)}` : null;
}

export function marketplaceSearchHref(filters: StorefrontFilterInput = {}): string {
  return `/shop/search${canonicalStorefrontQuery(filters)}`;
}

export function marketplaceCartHref(): string {
  return "/cart";
}

export function marketplaceCheckoutHref(): string {
  return "/checkout";
}

export function marketplaceCollectionsHref(): string {
  return "/shop/collections";
}

export function marketplaceCollectionHref(slug: string): string | null {
  const safeSlug = marketplaceSlug(slug);
  return safeSlug ? `${marketplaceCollectionsHref()}/${encodeSegment(safeSlug)}` : null;
}

export function marketplaceListingHref(route: MarketplaceListingRoute, filters: StorefrontFilterInput = {}): string {
  const listingFilters = { ...filters };
  if (route.kind === "category") listingFilters.category = undefined;
  if (route.kind === "store") listingFilters.store = undefined;
  if (route.kind === "store-category") {
    listingFilters.store = undefined;
    listingFilters.category = undefined;
  }
  const query = canonicalStorefrontQuery(listingFilters);
  if (route.kind === "search") return marketplaceSearchHref(listingFilters);
  if (route.kind === "category") return `${marketplaceCategoryHref(route.categoryPath) ?? marketplaceCategoriesHref()}${query}`;
  if (route.kind === "store") return `${marketplaceStoreHref(route.storeSlug) ?? marketplaceStoresHref()}${query}`;
  return `${marketplaceStoreCategoryHref(route.storeSlug, route.categoryPath) ?? marketplaceStoresHref()}${query}`;
}
