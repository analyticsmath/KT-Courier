import type { MetadataRoute } from "next";
import { listStorefrontCategories, listStorefrontStores } from "@/lib/services/storefront-catalog.service";
import { marketplaceCategoryHref, marketplaceProductHref, marketplaceStoreHref, marketplaceVariantHref } from "@/lib/public-marketplace/routes";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { canonicalSiteOrigin } from "@/lib/public-site/site-origin";

const BASE_URL = canonicalSiteOrigin.origin;
const SEGMENTS = ["categories", "products", "variants", "stores", "collections"] as const;
/** Sitemap entries come only from the same active public projections as the pages. */
export async function generateSitemaps() { return SEGMENTS.map((id) => ({ id })); }
export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const segment = await id;
  if (segment === "categories") return (await listStorefrontCategories()).flatMap((category) => { const href = marketplaceCategoryHref(category.path); return href ? [{ url: `${BASE_URL}${href}`, lastModified: category.updatedAt, changeFrequency: "weekly" as const }] : []; });
  if (segment === "stores") return (await listStorefrontStores({ limit: 100 })).flatMap((store) => { const href = marketplaceStoreHref(store.slug); return href ? [{ url: `${BASE_URL}${href}`, changeFrequency: "weekly" as const }] : []; });
  const documents = await new PostgresStorefrontSearchAdapter().search({ limit: 200 });
  if (segment === "products") return [...new Map(documents.filter((document) => document.indexable).map((document) => [document.productReference, document])).values()].flatMap((product) => { const href = marketplaceProductHref(product.productSlug, product.productReference); return href ? [{ url: `${BASE_URL}${href}`, lastModified: product.sourceUpdatedAt, changeFrequency: "weekly" as const }] : []; });
  if (segment === "variants") return documents.filter((document) => document.indexable).flatMap((variant) => { const href = marketplaceVariantHref(variant.productSlug, variant.productReference, variant.variantReference); return href ? [{ url: `${BASE_URL}${href}`, lastModified: variant.sourceUpdatedAt, changeFrequency: "weekly" as const }] : []; });
  return [];
}
