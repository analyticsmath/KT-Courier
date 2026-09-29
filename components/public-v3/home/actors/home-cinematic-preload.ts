import { HOME_BOX_SEQUENCE, HOME_DELIVERY_SEQUENCE, HOME_HANDOFF_SEQUENCE, HOME_PICKUP_SEQUENCE, HOME_RETURN_SEQUENCE, HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import type { HomeChapter } from "../director/home-chapters";
import { preloadCinematicAsset } from "./home-cinematic-runtime";

export function preloadCinematicWindow(ids: readonly string[], index: number, mobile: boolean) {
  for (let offset = -1; offset <= 2; offset++) {
    const id = ids[Math.max(0, Math.min(ids.length - 1, index + offset))];
    if (id) void preloadCinematicAsset(id, mobile);
  }
}

export function preloadCinematicTier(chapter: HomeChapter, progress: number, mobile: boolean) {
  if (chapter === "commerce" && progress > .72) HOME_BOX_SEQUENCE.slice(0, 3).forEach((id) => void preloadCinematicAsset(id, mobile));
  if (chapter === "parcelization") {
    HOME_BOX_SEQUENCE.forEach((id) => void preloadCinematicAsset(id, mobile));
    HOME_PICKUP_SEQUENCE.slice(0, progress > .7 ? 8 : 3).forEach((id) => void preloadCinematicAsset(id, mobile));
  }
  if (chapter === "pickup" && progress > .55) {
    HOME_ROUTE_VAN_SEQUENCE.slice(0, 2).forEach((id) => void preloadCinematicAsset(id, mobile));
    void preloadCinematicAsset("road-00", mobile);
  }
  if (chapter === "network" && progress > .35) {
    HOME_ROUTE_VAN_SEQUENCE.forEach((id) => void preloadCinematicAsset(id, mobile));
    void preloadCinematicAsset("red-truck-top-00", mobile);
  }
  if (chapter === "freight" && progress > .4) HOME_DELIVERY_SEQUENCE.slice(0, 9).forEach((id) => void preloadCinematicAsset(id, mobile));
  if (chapter === "last-mile" && progress > .28) {
    HOME_HANDOFF_SEQUENCE.forEach((id) => void preloadCinematicAsset(id, mobile));
    HOME_RETURN_SEQUENCE.forEach((id) => void preloadCinematicAsset(id, mobile));
  }
}
