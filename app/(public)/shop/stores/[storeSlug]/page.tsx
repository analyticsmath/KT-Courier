import type { Metadata } from "next";
import { StoreHero, CommerceResultsLayout } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceHref, marketplaceSlug, marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { storefrontFilterHasCrawlRisk } from "@/lib/storefront/search/storefront-filter-url";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<MarketplaceSearchParams>;
}): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const storeSlug = marketplaceSlug((await params).storeSlug);
  if (!storeSlug) return {};
  const store = await getStorefrontStore(storeSlug);
  const filters = parseMarketplaceSearchParams(await searchParams);
  const canonical = store ? marketplaceStoreHref(store.slug) : null;
  return store
    ? {
        title: `${store.name} | Storefront`,
        description: store.description,
        alternates: canonical ? { canonical } : undefined,
        ...(store.heroMediaReference
          ? { openGraph: { images: [{ url: `/api/catalog/media/${store.heroMediaReference}`, alt: store.name }] } }
          : {}),
        ...(storefrontFilterHasCrawlRisk(filters) ? { robots: { index: false, follow: true } } : {}),
      }
    : {};
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const storeSlug = marketplaceSlug((await params).storeSlug);
  if (!storeSlug) notFound();
  const store = await getStorefrontStore(storeSlug);
  if (!store) notFound();
  const requested = parseMarketplaceSearchParams(await searchParams);
  const filters = { ...requested, store: store.slug };
  const result = await new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search(filters);

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      {/* Branded Store Hero */}
      <StoreHero store={store} />

      {/* Scoped Store Catalog Results */}
      <CommerceResultsLayout
        breadcrumbs={[
          { label: "Shop", href: marketplaceHref() },
          { label: "Stores", href: marketplaceStoresHref() },
          { label: store.name },
        ]}
        description={`Browse ${store.name}’s live catalog. Availability is confirmed from the selected product, store and delivery details.`}
        emptyDescription="This storefront does not have matching products at the moment."
        emptyTitle="No published products yet"
        filters={filters}
        retainedFilters={{ store: store.slug }}
        result={result}
        route={{ kind: "store", storeSlug: store.slug }}
        title="Store Catalog"
      />
    </main>
  );
}
