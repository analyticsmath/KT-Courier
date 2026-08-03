import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketplaceResults } from "@/components/public-v2/marketplace/MarketplaceResults";
import { MarketplaceCategoryRail } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceHref, marketplaceSlug, marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { storefrontFilterHasCrawlRisk } from "@/lib/storefront/search/storefront-filter-url";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<MarketplaceSearchParams> }): Promise<Metadata> {
  const storeSlug = marketplaceSlug((await params).storeSlug);
  if (!storeSlug) return {};
  const store = await getStorefrontStore(storeSlug);
  const filters = parseMarketplaceSearchParams(await searchParams);
  const canonical = store ? marketplaceStoreHref(store.slug) : null;
  return store ? {
    title: store.name,
    description: store.description,
    alternates: canonical ? { canonical } : undefined,
    ...(store.heroMediaReference ? { openGraph: { images: [{ url: `/api/catalog/media/${store.heroMediaReference}`, alt: store.name }] } } : {}),
    ...(storefrontFilterHasCrawlRisk(filters) ? { robots: { index: false, follow: true } } : {}),
  } : {};
}

export default async function StorePage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<MarketplaceSearchParams> }) {
  const storeSlug = marketplaceSlug((await params).storeSlug);
  if (!storeSlug) notFound();
  const store = await getStorefrontStore(storeSlug);
  if (!store) notFound();
  const requested = parseMarketplaceSearchParams(await searchParams);
  const filters = { ...requested, store: store.slug };
  const result = await new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search(filters);
  const storeCategories = store.storeCategories ?? [];

  return (
    <div className={styles.page}>
      <section className={styles.storeHero}>
        <div className={styles.storeHeroMedia}>{store.heroMediaReference ? <Image alt="" fill preload sizes="(max-width: 899px) 100vw, 42vw" src={`/api/catalog/media/${store.heroMediaReference}`} /> : <div aria-label={`${store.name} cover image unavailable`} className={styles.storeMediaUnavailable} role="img">Image unavailable</div>}</div>
        <div className={styles.storeHeroCopy}>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / <Link href={marketplaceStoresHref()}>Stores</Link> / <span aria-current="page">{store.name}</span></nav>
          <div className={styles.storeIdentity}>{store.logoMediaReference ? <span className={styles.logo}><Image alt={`${store.name} logo`} fill sizes="48px" src={`/api/catalog/media/${store.logoMediaReference}`} /></span> : null}<p className={styles.eyebrow}>Marketplace storefront</p></div>
          <h1>{store.name}</h1>
          {store.description ? <p className={styles.storeDescription}>{store.description}</p> : null}
          <p className={styles.mediaNote}>Published storefront · {store.publishedOfferCount} {store.publishedOfferCount === 1 ? "published product" : "published products"}</p>
          {storeCategories.length ? <MarketplaceCategoryRail categories={storeCategories} label={`${store.name} categories`} storeSlug={store.slug} /> : null}
        </div>
      </section>
      <MarketplaceResults description="Browse this store’s published catalog. Product and fulfilment availability are confirmed by the canonical marketplace flow." emptyDescription="This published storefront does not have matching products at the moment. Its public identity remains available while the catalog changes." emptyTitle="No published products yet" filters={filters} result={result} retainedFilters={{ store: store.slug }} route={{ kind: "store", storeSlug: store.slug }} title="Store catalog" />
    </div>
  );
}
