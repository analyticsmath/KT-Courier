import type { Metadata } from "next";
import { MarketplaceSearchDiscovery, MarketplaceResults } from "@/components/public-v2/marketplace/MarketplaceResults";
import { parseMarketplaceSearchParams, type MarketplaceSearchParams } from "@/lib/public-marketplace/search-params";
import { getStorefrontCategory, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";

export const metadata: Metadata = {
  title: "Search Marketplace | KT Couriers",
  description: "Search published products across local stores connected to the KT Couriers marketplace.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<MarketplaceSearchParams> }) {
  const filters = parseMarketplaceSearchParams(await searchParams);
  const service = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
  const [result, suggestions] = await Promise.all([
    service.search(filters),
    filters.q ? service.suggest(filters.q) : Promise.resolve(null),
  ]);
  const [stores, categories] = suggestions ? await Promise.all([
    Promise.all(suggestions.stores.map((store) => getStorefrontStore(store.slug))).then((records) => records.filter((record): record is NonNullable<typeof record> => Boolean(record))),
    Promise.all(suggestions.categories.map((category) => getStorefrontCategory(category.path))).then((records) => records.filter((record): record is NonNullable<typeof record> => Boolean(record))),
  ]) : [[], []];
  const title = filters.q ? `Results for “${filters.q}”` : "Search the marketplace.";
  return <MarketplaceResults context={stores.length || categories.length ? <MarketplaceSearchDiscovery categories={categories} stores={stores} /> : undefined} description="Search is served from the current storefront index. Filter and sort selections are retained in the URL." filters={filters} result={result} route={{ kind: "search" }} title={title} />;
}
