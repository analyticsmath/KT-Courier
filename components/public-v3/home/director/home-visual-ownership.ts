import type { HomeChapter } from "./home-chapters";

export type VisualOwner =
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
    marketplace: "marketplace-media",
    fan: "story-media",
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
