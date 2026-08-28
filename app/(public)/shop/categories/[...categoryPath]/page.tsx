import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CommerceResultsLayout } from "@/components/public-v2/commerce";
import { MarketplaceCategoryRail } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoriesHref,
  marketplaceCategoryHref,
  marketplaceCategoryPath,
  marketplaceHref,
} from "@/lib/public-marketplace/routes";
import { getStorefrontCategory } from "@/lib/services/storefront-catalog.service";
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
  params: Promise<{ categoryPath: string[] }>;
  searchParams: Promise<MarketplaceSearchParams>;
}): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const categoryPath = marketplaceCategoryPath((await params).categoryPath);
  if (!categoryPath) return {};
  const category = await getStorefrontCategory(categoryPath);
  const filters = parseMarketplaceSearchParams(await searchParams);
  const canonical = category ? marketplaceCategoryHref(category.path) : null;
  return category
    ? {
        title: `${category.name} | KT Couriers Marketplace`,
        description: category.description,
        alternates: canonical ? { canonical } : undefined,
        ...(category.imageReference
          ? { openGraph: { images: [{ url: `/api/catalog/media/${category.imageReference}`, alt: category.name }] } }
          : {}),
        ...(storefrontFilterHasCrawlRisk(filters) ? { robots: { index: false, follow: true } } : {}),
      }
    : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryPath: string[] }>;
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const categoryPath = marketplaceCategoryPath((await params).categoryPath);
  if (!categoryPath) notFound();
  const category = await getStorefrontCategory(categoryPath);
  if (!category) notFound();
  const requested = parseMarketplaceSearchParams(await searchParams);
  const filters = { ...requested, category: category.path, cursor: requested.cursor };
  const result = await new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search(filters);

  const context = (
    <div style={{ marginBottom: "2rem" }}>
      {category.imageReference && (
        <div className={styles.categoryOpeningMediaFrame} style={{ marginBottom: "1.5rem" }}>
          <Image
            alt={category.name}
            fill
            priority
            sizes="(max-width: 899px) 100vw, 88rem"
            src={`/api/catalog/media/${category.imageReference}`}
            style={{ objectFit: "cover" }}
          />
        </div>
      )}

      {category.children && category.children.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12, color: "var(--kt-carbon, #101210)" }}>
            Subcategories
          </h2>
          <div className={styles.subcategoriesRail}>
            {category.children.map((sub) => {
              const subHref = marketplaceCategoryHref(sub.path) ?? marketplaceHref();
              return (
                <Link className={styles.subcategoryTile} href={subHref} key={sub.reference}>
                  <span>{sub.name}</span>
                </Link>
              );
            })}
          </div>
          <div style={{ display: "none" }}>
            <MarketplaceCategoryRail categories={category.children} label={`${category.name} subcategories`} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <CommerceResultsLayout
        breadcrumbs={[
          { label: "Shop", href: marketplaceHref() },
          { label: "Categories", href: marketplaceCategoriesHref() },
          { label: category.name },
        ]}
        context={context}
        description={category.description}
        emptyDescription="This category currently has no matching items. Explore its subcategories or return to all categories."
        emptyTitle="No products in this category yet"
        filters={filters}
        retainedFilters={{ category: category.path }}
        result={result}
        route={{ kind: "category", categoryPath: category.path }}
        title={category.name}
      />
    </main>
  );
}
