import type { MarketplaceStore } from "./MarketplaceLanding";

export function selectCinemaStores(stores: readonly MarketplaceStore[], mode: "featured" | "directory") {
  return mode === "featured"
    ? [...stores].sort((a, b) => b.publishedOfferCount - a.publishedOfferCount || a.name.localeCompare(b.name)).slice(0, 7)
    : stores;
}
