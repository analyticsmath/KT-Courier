import type { Metadata } from "next";
import Image from "next/image";
import { MarketplaceCategoryRail } from "@/components/public-v2/marketplace/MarketplaceCards";
import { MarketplaceResults } from "@/components/public-v2/marketplace/MarketplaceResults";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceCategoriesHref, marketplaceCategoryHref, marketplaceCategoryPath, marketplaceHref } from "@/lib/public-marketplace/routes";
import { getStorefrontCategory } from "@/lib/services/storefront-catalog.service";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { storefrontFilterHasCrawlRisk } from "@/lib/storefront/search/storefront-filter-url";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ categoryPath: string[] }>; searchParams: Promise<MarketplaceSearchParams> }): Promise<Metadata> {
  const categoryPath = marketplaceCategoryPath((await params).categoryPath);
  if (!categoryPath) return {};
  const category = await getStorefrontCategory(categoryPath);
  const filters = parseMarketplaceSearchParams(await searchParams);
  const canonical = category ? marketplaceCategoryHref(category.path) : null;
  return category ? {
    title: category.name,
    description: category.description,
    alternates: canonical ? { canonical } : undefined,
    ...(category.imageReference ? { openGraph: { images: [{ url: `/api/catalog/media/${category.imageReference}`, alt: category.name }] } } : {}),
    ...(storefrontFilterHasCrawlRisk(filters) ? { robots: { index: false, follow: true } } : {}),
  } : {};
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ categoryPath: string[] }>; searchParams: Promise<MarketplaceSearchParams> }) {
  const categoryPath = marketplaceCategoryPath((await params).categoryPath);
  if (!categoryPath) notFound();
  const category = await getStorefrontCategory(categoryPath);
  if (!category) notFound();
  const requested = parseMarketplaceSearchParams(await searchParams);
  const filters = { ...requested, category: category.path, cursor: requested.cursor };
  const result = await new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search(filters);
  const context = category.imageReference || category.children.length ? <section className={styles.categoryContext} aria-label={`${category.name} category context`}>
    {category.imageReference ? <div className={styles.categoryContextMedia}><Image alt="" fill sizes="(max-width: 899px) calc(100vw - 40px), 36vw" src={`/api/catalog/media/${category.imageReference}`} /></div> : null}
    {category.children.length ? <div><p className={styles.eyebrow}>Continue exploring</p><h2 className={styles.contextHeading}>Subcategories</h2><MarketplaceCategoryRail categories={category.children} label={`${category.name} subcategories`} /></div> : null}
  </section> : undefined;
  return <MarketplaceResults breadcrumbs={[{ label: "Shop", href: marketplaceHref() }, { label: "Categories", href: marketplaceCategoriesHref() }, { label: category.name }]} context={context} description={category.description} emptyDescription="This published category does not have matching products at the moment. Explore its subcategories or return to the marketplace." emptyTitle="No products in this category yet" filters={filters} result={result} retainedFilters={{ category: category.path }} route={{ kind: "category", categoryPath: category.path }} title={category.name} />;
}
