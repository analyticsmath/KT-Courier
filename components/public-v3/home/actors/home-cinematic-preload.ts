import { HOME_ROUTE_VAN_SEQUENCE } from "../data/home-cinematic-assets.generated";
import type { HomeChapter } from "../director/home-chapters";
import { rollingPreloadIds } from "../director/home-cinematic-mechanics";
import { preloadCinematicAsset } from "./home-cinematic-runtime";

export function preloadCinematicWindow(ids: readonly string[], index: number, mobile: boolean) {
  for (const id of rollingPreloadIds(ids, index)) void preloadCinematicAsset(id, mobile);
}

/** Warm only the first useful state of the next scene. Active pose changes decode on request. */
export function preloadCinematicTier(chapter: HomeChapter, progress: number, mobile: boolean) {
  const ids = chapter === "parcelization" && progress > .7 ? ["van-open-right", "van-door-right", "courier-carry-right"]
    : chapter === "pickup" && progress > .65 ? HOME_ROUTE_VAN_SEQUENCE.slice(0, 2)
    : chapter === "network" && progress > .7 ? ["red-truck-top-00"]
    : chapter === "freight" && progress > .65 ? ["van-open-left", "van-door-left", "courier-carry-left", "recipient-ready"]
    : [];
  for (const id of ids) void preloadCinematicAsset(id, mobile);
}
