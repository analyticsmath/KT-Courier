import type { HomeChapter, PostHeroChapter } from "./home-chapters";
import { clamp01, HOME_BEATS, range, smooth } from "./home-beats";
import { COURIER_LAST_MILE_STATE_IDS, HANDOFF_STATE_IDS, RECIPIENT_STATE_IDS, RED_TRUCK_WIPE_STATE_IDS, VAN_DELIVERY_STATE_IDS } from "../../actors/actor-state-machine";

export const MOTION_OWNERS = ["none", "commerce-aperture", "category-atlas", "store-index", "product-fan", "selected-product-carry", "packaging", "label-route", "route-truck", "route-camera-seam", "red-truck", "red-trailer-takeover", "van", "van-door", "courier", "recipient", "handoff", "van-return", "finale-brand", "finale-utility"] as const;
export type MotionOwner = (typeof MOTION_OWNERS)[number];
export type PostHeroActorName = "van" | "courier" | "recipient" | "handoff" | "white-truck" | "red-truck";
export type ActorSize = { mode: "visible-width"; valueVw: number } | { mode: "visible-height"; valueVh: number };
export type PostHeroActorKey = `${PostHeroActorName}:${string}`;
export type PostHeroActorPose = { state: PostHeroActorKey; visible: boolean; anchorXVw: number; anchorYVh: number; size: ActorSize; rotation: number };
export type PostHeroActorFrames = Record<PostHeroActorName, PostHeroActorPose>;

export interface MarketplaceFrame { activeIndex: number; positionIndex: number; storeIndex: number; productIndex: number; exitProgress: number; motionOwner: MotionOwner; }
export interface PostHeroFrame {
  chapter: HomeChapter;
  progress: number;
  motionOwner: MotionOwner;
  actors: PostHeroActorFrames;
  marketplace?: MarketplaceFrame;
  selectedCarryProgress: number;
  packageProgress: number;
  labelRouteProgress: number;
  roadReveal: number;
  routeProgress: number;
  trailerProgress: number;
  handoffProgress: number;
  brandProgress: number;
  utilityProgress: number;
  legalProgress: number;
}

const hidden = (state: PostHeroActorKey): PostHeroActorPose => ({ state, visible: false, anchorXVw: 50, anchorYVh: 86, size: { mode: "visible-width", valueVw: 0 }, rotation: 0 });
const pose = (state: PostHeroActorKey, anchorXVw: number, anchorYVh: number, size: ActorSize, visible = true, rotation = 0): PostHeroActorPose => ({ state, visible, anchorXVw, anchorYVh, size, rotation });
const actors = (): PostHeroActorFrames => ({
  van: hidden("van:delivery-side-hold"), courier: hidden("courier:delivery-hold"), recipient: hidden("recipient:neutral"), handoff: hidden("handoff:approach-gap"),
  "white-truck": hidden("white-truck:top-down-straight"), "red-truck": hidden("red-truck:wipe-entry-01"),
});
const stateAt = (progress: number, start: number, end: number, states: readonly string[]): string => {
  const index = Math.min(states.length - 1, Math.floor(range(progress, start, end) * states.length));
  return states[index] || states[states.length - 1] || "";
};

export const POST_HERO_RESOLVER_ACTOR_STATES: readonly PostHeroActorKey[] = [
  ...VAN_DELIVERY_STATE_IDS.map((id) => `van:${id}` as PostHeroActorKey),
  ...RED_TRUCK_WIPE_STATE_IDS.map((id) => `red-truck:${id}` as PostHeroActorKey),
  ...COURIER_LAST_MILE_STATE_IDS.map((id) => `courier:${id}` as PostHeroActorKey),
  ...RECIPIENT_STATE_IDS.map((id) => `recipient:${id}` as PostHeroActorKey),
  ...HANDOFF_STATE_IDS.map((id) => `handoff:${id}` as PostHeroActorKey),
  "white-truck:top-down-straight", "white-truck:top-down-angled", "white-truck:top-down-turning",
];
/** Legacy alias retained for consumers that still reference the old route seam. */
export const JOURNEY_ROAD_OCCLUSION_THRESHOLD = HOME_BEATS.network.overpassTakeover[0];

export function resolveMarketplaceFrame(progress: number, categoryCount: number, storeCount = 3, productCount = 5): MarketplaceFrame {
  const p = clamp01(progress); const count = Math.max(1, categoryCount); const stores = Math.max(0, storeCount); const products = Math.max(1, productCount); const positionIndex = p < .08 ? 0 : p < .5 ? ((p - .08) / .42) * Math.max(0, count - 1) : count - 1;
  const storeIndex = stores >= 3 ? Math.min(stores - 1, Math.max(0, Math.floor(range(p, .6, .73) * stores))) : -1;
  const productIndex = Math.min(products - 1, Math.max(0, Math.floor(range(p, stores >= 3 ? .76 : .56, .94) * products)));
  const motionOwner = p < .08 ? "commerce-aperture" : p < .5 ? "category-atlas" : p < .56 ? "none" : stores >= 3 && p < .76 ? "store-index" : p < .94 ? "product-fan" : "selected-product-carry";
  return { activeIndex: Math.max(0, Math.min(count - 1, Math.round(positionIndex))), positionIndex, storeIndex, productIndex, exitProgress: range(p, .94, 1), motionOwner };
}

export type PostHeroContentCounts = { categoryCount?: number; storeCount?: number; productCount?: number };

function resolveNetwork(frame: PostHeroFrame, p: number, mobile: boolean) {
  const beats = HOME_BEATS.network;
  if (p < beats.overpassTakeover[0]) {
    const route = p < beats.angledTransition[0] ? "white-truck:top-down-straight" : p < beats.turningTransition[0] ? "white-truck:top-down-angled" : "white-truck:top-down-turning";
    frame.actors["white-truck"] = pose(route, 50, 66, { mode: "visible-width", valueVw: mobile ? 24 : 14 });
  }
  frame.roadReveal = range(p, ...beats.routeEstablish); frame.routeProgress = p < beats.angledTransition[0] ? range(p, ...beats.straightTravel) * .38 : p < beats.turningTransition[0] ? .38 + range(p, ...beats.angledTravel) * .3 : .68 + range(p, ...beats.turningTravel) * .32;
  frame.motionOwner = p < beats.angledTransition[0] ? "route-truck" : p < beats.turningTransition[0] ? "route-truck" : p < beats.overpassTakeover[0] ? "route-truck" : "route-camera-seam";
}

export function resolvePostHeroFrame(chapter: PostHeroChapter, progress: number, viewportMode: "mobile" | "desktop", counts: PostHeroContentCounts = {}): PostHeroFrame {
  const p = clamp01(progress); const mobile = viewportMode === "mobile";
  const frame: PostHeroFrame = { chapter, progress: p, motionOwner: "none", actors: actors(), selectedCarryProgress: 0, packageProgress: 0, labelRouteProgress: 0, roadReveal: 0, routeProgress: 0, trailerProgress: 0, handoffProgress: 0, brandProgress: 0, utilityProgress: 0, legalProgress: 0 };
  if (chapter === "commerce") { frame.marketplace = resolveMarketplaceFrame(p, counts.categoryCount ?? 5, counts.storeCount ?? 3, counts.productCount ?? 5); frame.motionOwner = frame.marketplace.motionOwner; return frame; }
  if (chapter === "parcelization") { frame.selectedCarryProgress = range(p, ...HOME_BEATS.parcelization.selectedCarry); frame.packageProgress = range(p, ...HOME_BEATS.parcelization.packageCover); frame.labelRouteProgress = range(p, ...HOME_BEATS.parcelization.labelToRoute); frame.motionOwner = p < .18 ? "selected-product-carry" : p < .48 ? "packaging" : p < .9 ? "label-route" : "route-camera-seam"; return frame; }
  if (chapter === "network") { resolveNetwork(frame, p, mobile); return frame; }
  if (chapter === "freight") {
    const b = HOME_BEATS.freight;
    if (p < b.redEntry[0]) {
      frame.actors["white-truck"] = pose("white-truck:top-down-turning", 50 - range(p, ...b.overpassRelease) * 12, 72, { mode: "visible-width", valueVw: mobile ? 24 : 14 });
    }
    if (p >= b.redEntry[0] && p < b.localWorldReveal[1]) {
      const state = p < b.redSettle[0]
        ? stateAt(p, ...b.redEntry, ["red-truck:wipe-entry-01", "red-truck:wipe-entry-02", "red-truck:wipe-entry-03"])
        : p < b.giantSweepFront[0]
          ? "red-truck:wipe-side-full"
          : p < b.giantSweepMid[0]
            ? "red-truck:wipe-giant-full"
            : p < b.giantSweepRear[0]
              ? "red-truck:wipe-giant-front"
              : p < b.trailerTakeover[0]
                ? stateAt(p, ...b.giantSweepRear, ["red-truck:wipe-giant-mid", "red-truck:wipe-giant-rear"])
                : p < b.trailerTakeover[1]
                  ? stateAt(p, ...b.trailerTakeover, ["red-truck:wipe-rear-transition", "red-truck:wipe-trailer-hold"])
                  : p < b.localWorldReveal[0] + .04
                    ? "red-truck:wipe-exit"
                    : "red-truck:wipe-departure-tail";
      frame.actors["red-truck"] = pose(state, p < b.trailerTakeover[0] ? 52 : 50, 78, { mode: "visible-width", valueVw: mobile ? 190 : p < b.giantSweepFront[0] ? 78 : 140 });
    }
    frame.trailerProgress = range(p, ...b.trailerTakeover); frame.motionOwner = p < b.redEntry[0] ? "route-camera-seam" : p < b.giantSweepRear[1] ? "red-truck" : p < b.localWorldReveal[0] ? "red-trailer-takeover" : "none"; return frame;
  }
  if (chapter === "last-mile") {
    const b = HOME_BEATS.lastMile; const vanSize = mobile ? 128 : 58; const vanX = p < b.vanSettle[1] ? 118 - smooth(range(p, ...b.vanEntry)) * 68 : p < b.vanDeparture[0] ? 50 : 50 - range(p, ...b.vanDeparture) * 90;
    if (p >= b.vanEntry[0]) {
      const vanState = p < b.vanApproach[0] ? stateAt(p, ...b.vanEntry, ["van:delivery-entry-01", "van:delivery-entry-02", "van:delivery-entry-03", "van:delivery-entry-04"]) : p < b.vanSettle[0] ? "van:delivery-center-approach" : p < b.vanSettle[1] ? "van:delivery-center-settle" : p < b.vanDoorOpen[0] ? "van:delivery-side-hold" : p < b.vanDoorClose[0] ? stateAt(p, ...b.vanDoorOpen, ["van:delivery-door-open-15", "van:delivery-door-open-35", "van:delivery-door-open-60", "van:delivery-door-open-85", "van:delivery-door-open-full"]) : p < b.vanDeparture[0] ? stateAt(p, ...b.vanDoorClose, ["van:delivery-door-close-60", "van:delivery-door-close-20", "van:delivery-side-hold"]) : stateAt(p, ...b.vanDeparture, ["van:delivery-departure-start", "van:delivery-departure-exit"]);
      frame.actors.van = pose(vanState, vanX, mobile ? 86 : 85, { mode: "visible-width", valueVw: vanSize });
    }
    // The combined Handoff bank takes over the custody moment. Independent
    // Courier and Recipient slots must be hidden before the shared actor
    // appears so there is never an open-view double render.
    if (p >= b.courierReveal[0] && p < b.combinedHandoff[0]) { const state = p < b.courierWalk[0] ? "courier:delivery-hold" : p < b.preHandoff[0] ? stateAt(p, ...b.courierWalk, ["courier:walk-left-01", "courier:walk-left-02"]) : stateAt(p, ...b.preHandoff, ["courier:approach-hold", "courier:present", "courier:offer", "courier:release-pre", "courier:release-post"]); frame.actors.courier = pose(state, mobile ? 57 : 55 - range(p, ...b.courierWalk) * 13, mobile ? 86 : 85, { mode: "visible-height", valueVh: mobile ? 62 : 64 }); }
    if (p >= b.recipientReveal[0] && p < b.combinedHandoff[0]) { const state = stateAt(p, ...b.recipientReveal, ["recipient:neutral", "recipient:ready", "recipient:reach", "recipient:receive-contact"]); frame.actors.recipient = pose(state, mobile ? 24 : 22 + range(p, ...b.recipientReveal) * 18, mobile ? 86 : 85, { mode: "visible-height", valueVh: mobile ? 62 : 64 }); }
    if (p >= b.combinedHandoff[0] && p < b.separation[1]) { const state = p < b.separation[0] ? stateAt(p, ...b.combinedHandoff, ["handoff:approach-gap", "handoff:handoff-start", "handoff:shared-contact", "handoff:transfer-complete", "handoff:post-handoff"]) : "handoff:separation"; frame.actors.handoff = pose(state, 50, mobile ? 86 : 85, { mode: "visible-height", valueVh: mobile ? 68 : 70 }); }
    if (p >= b.separation[1]) { frame.actors.recipient = pose(p < b.courierReturn[0] ? "recipient:after-receive" : "recipient:hold-relaxed", 28, mobile ? 86 : 85, { mode: "visible-height", valueVh: mobile ? 62 : 64 }); if (p < b.vanDoorClose[0]) frame.actors.courier = pose(p < b.courierReturn[0] ? "courier:turn-back" : stateAt(p, ...b.courierReturn, ["courier:return-right-01", "courier:return-right-02"]), 55 + range(p, ...b.courierReturn) * 12, mobile ? 86 : 85, { mode: "visible-height", valueVh: mobile ? 62 : 64 }); }
    frame.handoffProgress = range(p, ...b.combinedHandoff); frame.motionOwner = p < b.vanDoorOpen[0] ? "van" : p < b.courierReveal[0] ? "van-door" : p < b.recipientReveal[0] ? "courier" : p < b.combinedHandoff[0] ? "recipient" : p < b.separation[1] ? "handoff" : p < b.vanDoorClose[0] ? "van-return" : "van-door"; return frame;
  }
  if (chapter === "finale") { frame.brandProgress = range(p, ...HOME_BEATS.finale.brandRise); frame.utilityProgress = range(p, ...HOME_BEATS.finale.utilityReveal); frame.legalProgress = range(p, ...HOME_BEATS.finale.legalReveal); frame.motionOwner = p < HOME_BEATS.finale.brandRise[0] ? "none" : p < HOME_BEATS.finale.utilityReveal[0] ? "finale-brand" : "finale-utility"; }
  return frame;
}
