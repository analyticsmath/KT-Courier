import type { Metadata } from "next";
import { CommerceResultsLayout } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoryPath,
  marketplaceHref,
  marketplaceSlug,
  marketplaceStoreHref,
  marketplaceStoresHref,
} from "@/lib/public-marketplace/routes";
import { getStorefrontCategory, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export const metadata: Metadata = noIndexPublicMetadata;

export default async function StoreCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string; categoryPath: string[] }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
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

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <CommerceResultsLayout
        breadcrumbs={[
          { label: "Shop", href: marketplaceHref() },
          { label: "Stores", href: marketplaceStoresHref() },
          ...(storeHref ? [{ label: store.name, href: storeHref }] : []),
          { label: categoryRecord.name },
        ]}
        description={`Products from ${store.name} in ${categoryRecord.name}.`}
        emptyDescription={`${store.name} currently has no products in this category.`}
        emptyTitle="No items in this category"
        filters={filters}
        retainedFilters={{ store: store.slug, category: categoryRecord.path }}
        result={result}
        route={{ kind: "store-category", storeSlug: store.slug, categoryPath: categoryRecord.path }}
        title={`${store.name} — ${categoryRecord.name}`}
      />
    </main>
  );
}
