import type { HomeChapter } from "./home-chapters";

export type VisualOwner =
  | "none"
  | "market-rail"
  | "market-backdrop"
  | "fan-support"
  | "fan-transfer"
  | "marketplace-media"
  | "story-media"
  | "preparation"
  | "collection-environment"
  | "van"
  | "courier"
  | "custody-media"
  | "route-road"
  | "white-truck"
  | "freight-truck"
  | "arrival-media"
  | "finale-brand";

export function visualOwnership(chapter: HomeChapter): { primaryOwner: VisualOwner; incomingOwner?: VisualOwner } {
  const owners: Record<HomeChapter, VisualOwner> = {
    hero: "white-truck",
    marketplace: "market-rail",
    fan: "fan-support",
    preparation: "preparation",
    collection: "collection-environment",
    custody: "custody-media",
    route: "route-road",
    freight: "freight-truck",
    arrival: "arrival-media",
    finale: "finale-brand",
  };
  return { primaryOwner: owners[chapter] };
}
