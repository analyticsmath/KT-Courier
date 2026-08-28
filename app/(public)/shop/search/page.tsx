import type { Metadata } from "next";
import Link from "next/link";
import {
  CommerceResultsLayout,
  CommerceSearchCommand,
} from "@/components/public-v2/commerce";
import { MarketplaceSearchDiscovery } from "@/components/public-v2/marketplace/MarketplaceResults";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoryHref,
  marketplaceHref,
  marketplaceSearchHref,
  marketplaceStoreHref,
} from "@/lib/public-marketplace/routes";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { getStorefrontCategory, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";

export const metadata: Metadata = {
  title: "Search Marketplace | KT Couriers",
  description: "Search published products across local stores connected to the KT Couriers marketplace.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const filters = parseMarketplaceSearchParams(await searchParams);
  const service = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
  const [result, suggestions] = await Promise.all([
    service.search(filters),
    filters.q ? service.suggest(filters.q) : Promise.resolve(null),
  ]);

  const [stores, categories] = suggestions
    ? await Promise.all([
        Promise.all(suggestions.stores.map((store) => getStorefrontStore(store.slug))).then((records) =>
          records.filter((record): record is NonNullable<typeof record> => Boolean(record))
        ),
        Promise.all(suggestions.categories.map((category) => getStorefrontCategory(category.path))).then((records) =>
          records.filter((record): record is NonNullable<typeof record> => Boolean(record))
        ),
      ])
    : [[], []];

  const title = filters.q ? `Results for “${filters.q}”` : "Search the Marketplace";

  const context = (
    <div style={{ marginBottom: "2rem" }}>
      {/* Search Input Command */}
      <div style={{ maxWidth: 540, marginBottom: "1.5rem" }}>
        <CommerceSearchCommand query={filters.q || ""} />
      </div>

      {/* Did you mean suggestion */}
      {result.correction && (
        <p style={{ fontSize: "1rem", color: "var(--kt-carbon, #101210)", margin: "0 0 1rem" }}>
          Did you mean:{" "}
          <Link
            className={styles.sectionDirectLink}
            href={marketplaceSearchHref({ q: result.correction })}
          >
            {result.correction}
          </Link>
        </p>
      )}

      {/* Suggested Matching Categories or Stores */}
      {(categories.length > 0 || stores.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--kt-cool-200, #dde1e0)" }}>
          {categories.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}>
                Categories:
              </span>
              {categories.map((cat) => {
                const catHref = marketplaceCategoryHref(cat.path) ?? marketplaceHref();
                return (
                  <Link
                    className={styles.subcategoryTile}
                    href={catHref}
                    key={cat.reference}
                    style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </div>
          )}

          {stores.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}>
                Storefronts:
              </span>
              {stores.map((store) => {
                const storeHref = marketplaceStoreHref(store.slug) ?? marketplaceHref();
                return (
                  <Link
                    className={styles.subcategoryTile}
                    href={storeHref}
                    key={store.reference}
                    style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                  >
                    {store.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Compatibility Discovery Helper */}
      <div style={{ display: "none" }}>
        <MarketplaceSearchDiscovery categories={categories} stores={stores} />
      </div>
    </div>
  );

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <CommerceResultsLayout
        breadcrumbs={[
          { label: "Shop", href: marketplaceHref() },
          { label: "Search" },
        ]}
        context={context}
        description="Search results across local independent stores and marketplace categories."
        emptyDescription="We couldn’t find products matching your search. Try searching for a broader term or browse all categories."
        emptyTitle="No results found"
        filters={filters}
        result={result}
        route={{ kind: "search" }}
        title={title}
      />
    </main>
  );
}
