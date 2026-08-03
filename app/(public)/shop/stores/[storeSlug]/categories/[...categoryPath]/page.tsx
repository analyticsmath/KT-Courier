import type { Metadata } from "next";
import { MarketplaceResults } from "@/components/public-v2/marketplace/MarketplaceResults";
import { marketplaceCategoryPath, marketplaceHref, marketplaceSlug, marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { getStorefrontCategory, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

/** A store-category view is a filtered presentation, not a canonical catalog URL. */
export const metadata: Metadata = noIndexPublicMetadata;

export default async function StoreCategoryPage({ params, searchParams }: { params: Promise<{ storeSlug: string; categoryPath: string[] }>; searchParams: Promise<MarketplaceSearchParams> }) {
  const { storeSlug, categoryPath } = await params;
  const safeStoreSlug = marketplaceSlug(storeSlug);
  if (!safeStoreSlug) notFound();
  const store = await getStorefrontStore(safeStoreSlug);
  if (!store) notFound();
  const category = marketplaceCategoryPath(categoryPath);
  if (!category) notFound();
  const categoryRecord = await getStorefrontCategory(category);
  if (!categoryRecord || !store.categories.includes(categoryRecord.reference)) notFound();
  const requested = parseMarketplaceSearchParams(await searchParams);
  const filters = { ...requested, store: store.slug, category: categoryRecord.path };
  const result = await new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search(filters);
  const storeHref = marketplaceStoreHref(store.slug);
  return <MarketplaceResults breadcrumbs={[{ label: "Shop", href: marketplaceHref() }, { label: "Stores", href: marketplaceStoresHref() }, ...(storeHref ? [{ label: store.name, href: storeHref }] : []), { label: categoryRecord.name }]} description={`Published products from ${store.name} in this category.`} emptyDescription={`${store.name} does not have published products in this category at the moment.`} emptyTitle="No store products in this category yet" filters={filters} result={result} retainedFilters={{ store: store.slug, category: categoryRecord.path }} route={{ kind: "store-category", storeSlug: store.slug, categoryPath: categoryRecord.path }} title={categoryRecord.name} />;
}
