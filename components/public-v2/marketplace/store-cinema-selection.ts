import type { MarketplaceStore } from "./MarketplaceLanding";

export function circularRelative(index: number, position: number, count: number) {
  if (count <= 0) return 0;
  let difference = index - position;
  while (difference > count / 2) difference -= count;
  while (difference < -count / 2) difference += count;
  return difference;
}

export function selectCinemaStores(stores: readonly MarketplaceStore[], mode: "featured" | "directory") {
  return mode === "featured"
    ? [...stores].sort((a, b) => b.publishedOfferCount - a.publishedOfferCount || a.name.localeCompare(b.name)).slice(0, 7)
    : stores;
}
