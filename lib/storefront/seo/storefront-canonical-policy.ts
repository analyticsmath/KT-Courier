import { marketplaceCategoryHref, marketplaceProductHref, marketplaceStoreHref, marketplaceVariantHref } from "@/lib/public-marketplace/routes";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function safeStorefrontSlug(value: string): string | undefined {
  const slug = value.toLocaleLowerCase("en-ZA").trim();
  return SLUG.test(slug) ? slug : undefined;
}
export function storefrontProductCanonical(productSlug: string, productReference: string): string { return marketplaceProductHref(safeStorefrontSlug(productSlug) ?? "product", productReference) ?? "/shop/products/product-unavailable"; }
export function storefrontVariantCanonical(productSlug: string, productReference: string, variantReference: string): string { return marketplaceVariantHref(safeStorefrontSlug(productSlug) ?? "product", productReference, variantReference) ?? storefrontProductCanonical(productSlug, productReference); }
export function storefrontCategoryCanonical(path: string): string { return marketplaceCategoryHref(path) ?? "/shop/categories"; }
export function storefrontStoreCanonical(slug: string): string { return marketplaceStoreHref(safeStorefrontSlug(slug) ?? "store") ?? "/shop/stores"; }
