import type { HomeChapter, PostHeroChapter } from "./home-chapters";
import { clamp01, getCommerceBeats, HOME_BEATS, range, smooth } from "./home-beats";
import { COURIER_LAST_MILE_STATE_IDS, HANDOFF_STATE_IDS, RECIPIENT_STATE_IDS, RED_TRUCK_WIPE_STATE_IDS, VAN_DELIVERY_STATE_IDS } from "../../actors/actor-state-machine";

export const MOTION_OWNERS = ["none", "commerce-aperture", "category-atlas", "store-index", "product-fan", "selected-product-carry", "packaging", "label-route", "route-truck", "route-camera-seam", "red-truck", "red-trailer-takeover", "van", "van-door", "courier", "recipient", "handoff", "van-return", "finale-brand", "finale-utility"] as const;
export type MotionOwner = (typeof MOTION_OWNERS)[number];
export type PostHeroActorName = "van" | "courier" | "recipient" | "handoff" | "white-truck" | "red-truck";
export type ActorSize = { mode: "visible-width"; valueVw: number } | { mode: "visible-height"; valueVh: number };
export type PostHeroActorKey = `${PostHeroActorName}:${string}`;
export type PostHeroActorPose = {
  state: PostHeroActorKey;
  visible: boolean;
  anchorXVw: number;
  anchorYVh: number;
  size: ActorSize;
  rotation: number;
  blendToState?: PostHeroActorKey;
  stateBlend?: number;
};
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

function sequenceState(progress: number, start: number, end: number, states: readonly string[], prefix: PostHeroActorName, blend = true): Pick<PostHeroActorPose, "state" | "blendToState" | "stateBlend"> {
  const local = range(progress, start, end);
  const index = Math.min(states.length - 1, Math.floor(local * states.length));
  const next = index + 1 < states.length ? states[index + 1] : undefined;
  const stateBlend = blend && next ? range(local, (index + .8) / states.length, (index + 1) / states.length) : 0;
  return {
    state: `${prefix}:${states[index]}` as PostHeroActorKey,
    ...(next && stateBlend > 0 ? { blendToState: `${prefix}:${next}` as PostHeroActorKey, stateBlend } : {}),
  };
}

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
  const p = clamp01(progress); const count = Math.max(1, categoryCount); const stores = Math.max(0, storeCount); const products = Math.max(1, productCount); const beats = getCommerceBeats(stores); const positionIndex = p < beats.categoryTraversal[0] ? 0 : p < beats.categoryTraversal[1] ? ((p - beats.categoryTraversal[0]) / (beats.categoryTraversal[1] - beats.categoryTraversal[0])) * Math.max(0, count - 1) : count - 1;
  const storeIndex = stores >= 3 ? Math.min(stores - 1, Math.max(0, Math.floor(range(p, ...beats.storeTraversal) * stores))) : -1;
  const productIndex = Math.min(products - 1, Math.max(0, range(p, beats.fanTraversal[0], beats.selectedTakeover[0]) * Math.max(0, products - 1)));
  const motionOwner = p < beats.apertureClear[1] ? "commerce-aperture" : p < beats.categoryTraversal[1] ? "category-atlas" : stores >= 3 && p < beats.fanBuild[0] ? "store-index" : p < beats.selectedTakeover[0] ? "product-fan" : "selected-product-carry";
  return { activeIndex: Math.max(0, Math.min(count - 1, Math.round(positionIndex))), positionIndex, storeIndex, productIndex, exitProgress: range(p, beats.selectedTakeover[0], 1), motionOwner };
}

export function resolveSelectedProductId(productIds: readonly string[], progress: number, storeCount: number, frozenId?: string): string | undefined {
  if (!productIds.length) return undefined;
  const frame = resolveMarketplaceFrame(progress, 1, storeCount, productIds.length);
  if (progress >= getCommerceBeats(storeCount).selectedTakeover[0]) return frozenId ?? productIds[Math.min(productIds.length - 1, Math.round(frame.productIndex))];
  return productIds[Math.min(productIds.length - 1, Math.round(frame.productIndex))];
}

/** Red Truck is the freight wipe: the generated frame sequence rides this physical viewport path. */
export function redTruckViewportX(progress: number): number {
  const p = clamp01(progress);
  const b = HOME_BEATS.freight;
  const segment = (start: number, end: number, from: number, to: number) => from + (to - from) * range(p, start, end);
  if (p < b.redEntry[0]) return 120;
  if (p < b.redEntry[1]) return segment(...b.redEntry, 120, 95);
  if (p < b.redSettle[1]) return segment(b.redEntry[1], b.redSettle[1], 95, 65);
  if (p < b.giantSweepFront[0]) return 65;
  if (p < b.giantSweepFront[1]) return segment(...b.giantSweepFront, 65, 42);
  if (p < b.giantSweepMid[1]) return segment(...b.giantSweepMid, 42, 18);
  if (p < b.giantSweepRear[1]) return segment(...b.giantSweepRear, 18, -8);
  if (p < b.trailerTakeover[1]) return segment(...b.trailerTakeover, -8, -45);
  return segment(b.trailerTakeover[1], 1, -45, -75);
}

export function redTruckActorSize(state: PostHeroActorKey, mobile: boolean): ActorSize {
  const targets: Record<string, ActorSize> = mobile ? {
    "red-truck:wipe-entry-01": { mode: "visible-width", valueVw: 108 },
    "red-truck:wipe-entry-02": { mode: "visible-width", valueVw: 122 },
    "red-truck:wipe-entry-03": { mode: "visible-width", valueVw: 136 },
    "red-truck:wipe-side-full": { mode: "visible-width", valueVw: 150 },
    "red-truck:wipe-giant-full": { mode: "visible-width", valueVw: 168 },
    "red-truck:wipe-giant-front": { mode: "visible-height", valueVh: 102 },
    "red-truck:wipe-giant-mid": { mode: "visible-height", valueVh: 104 },
    "red-truck:wipe-giant-rear": { mode: "visible-height", valueVh: 104 },
    "red-truck:wipe-rear-transition": { mode: "visible-height", valueVh: 102 },
    "red-truck:wipe-trailer-hold": { mode: "visible-width", valueVw: 176 },
    "red-truck:wipe-exit": { mode: "visible-height", valueVh: 102 },
    "red-truck:wipe-departure-tail": { mode: "visible-height", valueVh: 100 },
  } : {
    "red-truck:wipe-entry-01": { mode: "visible-width", valueVw: 32 },
    "red-truck:wipe-entry-02": { mode: "visible-width", valueVw: 46 },
    "red-truck:wipe-entry-03": { mode: "visible-width", valueVw: 62 },
    "red-truck:wipe-side-full": { mode: "visible-width", valueVw: 80 },
    "red-truck:wipe-giant-full": { mode: "visible-width", valueVw: 110 },
    "red-truck:wipe-giant-front": { mode: "visible-height", valueVh: 108 },
    "red-truck:wipe-giant-mid": { mode: "visible-height", valueVh: 114 },
    "red-truck:wipe-giant-rear": { mode: "visible-height", valueVh: 114 },
    "red-truck:wipe-rear-transition": { mode: "visible-height", valueVh: 110 },
    "red-truck:wipe-trailer-hold": { mode: "visible-width", valueVw: 128 },
    "red-truck:wipe-exit": { mode: "visible-height", valueVh: 110 },
    "red-truck:wipe-departure-tail": { mode: "visible-height", valueVh: 108 },
  };
  return targets[state] ?? { mode: "visible-width", valueVw: mobile ? 120 : 80 };
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
  if (chapter === "commerce") { frame.marketplace = resolveMarketplaceFrame(p, counts.categoryCount ?? 5, counts.storeCount ?? 0, counts.productCount ?? 5); frame.motionOwner = frame.marketplace.motionOwner; return frame; }
  if (chapter === "parcelization") { frame.selectedCarryProgress = range(p, ...HOME_BEATS.parcelization.selectedCarry); frame.packageProgress = range(p, .08, HOME_BEATS.parcelization.packageCover[1]); frame.labelRouteProgress = range(p, ...HOME_BEATS.parcelization.labelToRoute); frame.motionOwner = p < .2 ? "selected-product-carry" : p < .52 ? "packaging" : p < .9 ? "label-route" : "route-camera-seam"; return frame; }
  if (chapter === "network") { resolveNetwork(frame, p, mobile); return frame; }
  if (chapter === "freight") {
    const b = HOME_BEATS.freight;
    if (p < b.redEntry[0]) {
      frame.actors["white-truck"] = pose("white-truck:top-down-turning", 50 - range(p, ...b.overpassRelease) * 12, 72, { mode: "visible-width", valueVw: mobile ? 24 : 14 });
    }
    if (p >= b.redEntry[0] && p < b.localWorldReveal[1]) {
      const state = p < b.redSettle[0]
        ? sequenceState(p, ...b.redEntry, ["wipe-entry-01", "wipe-entry-02", "wipe-entry-03"], "red-truck").state
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
      const truckX = redTruckViewportX(p);
      const truckSize = redTruckActorSize(state as PostHeroActorKey, mobile);
      const redEntryBlend = p < b.redSettle[0] ? sequenceState(p, ...b.redEntry, ["wipe-entry-01", "wipe-entry-02", "wipe-entry-03"], "red-truck") : undefined;
      frame.actors["red-truck"] = pose(state as PostHeroActorKey, truckX, mobile ? 86 : 78, truckSize, true, 0);
      if (redEntryBlend?.blendToState && redEntryBlend.stateBlend) {
        frame.actors["red-truck"].blendToState = redEntryBlend.blendToState;
        frame.actors["red-truck"].stateBlend = redEntryBlend.stateBlend;
      }
    }
    frame.trailerProgress = range(p, ...b.trailerTakeover); frame.motionOwner = p < b.redEntry[0] ? "route-camera-seam" : p < b.giantSweepRear[1] ? "red-truck" : p < b.localWorldReveal[0] ? "red-trailer-takeover" : "none"; return frame;
  }
  if (chapter === "last-mile") {
    const b = HOME_BEATS.lastMile; const vanSize = mobile ? 124 : 56; const settledX = mobile ? 78 : 72; const vanX = p < b.vanSettle[1] ? 118 - smooth(range(p, ...b.vanEntry)) * (118 - settledX) : p < b.vanDeparture[0] ? settledX : settledX - range(p, ...b.vanDeparture) * 132;
    if (p >= b.vanEntry[0]) {
      const vanSequence = p < b.vanApproach[0] ? sequenceState(p, ...b.vanEntry, ["delivery-entry-01", "delivery-entry-02", "delivery-entry-03", "delivery-entry-04"], "van") : p < b.vanSettle[0] ? { state: "van:delivery-center-approach" as PostHeroActorKey } : p < b.vanSettle[1] ? { state: "van:delivery-center-settle" as PostHeroActorKey } : p < b.vanDoorOpen[0] ? { state: "van:delivery-side-hold" as PostHeroActorKey } : p < b.vanDoorClose[0] ? sequenceState(p, ...b.vanDoorOpen, ["delivery-door-open-15", "delivery-door-open-35", "delivery-door-open-60", "delivery-door-open-85", "delivery-door-open-full"], "van") : p < b.vanDeparture[0] ? sequenceState(p, ...b.vanDoorClose, ["delivery-door-close-60", "delivery-door-close-20", "delivery-side-hold"], "van") : sequenceState(p, ...b.vanDeparture, ["delivery-departure-start", "delivery-departure-exit"], "van");
      frame.actors.van = pose(vanSequence.state, vanX, mobile ? 88 : 87, { mode: "visible-width", valueVw: vanSize }, true, 0);
      if (vanSequence.blendToState && vanSequence.stateBlend) { frame.actors.van.blendToState = vanSequence.blendToState; frame.actors.van.stateBlend = vanSequence.stateBlend; }
    }
    // The combined Handoff bank takes over the custody moment. Independent
    // Courier and Recipient slots must be hidden before the shared actor
    // appears so there is never an open-view double render.
    if (p >= b.courierReveal[0] && p < b.combinedHandoff[0]) { const state = p < b.courierWalk[0] ? "courier:delivery-hold" : p < b.preHandoff[0] ? stateAt(p, ...b.courierWalk, ["courier:walk-left-01", "courier:walk-left-02"]) : stateAt(p, ...b.preHandoff, ["courier:approach-hold", "courier:present", "courier:offer", "courier:release-pre", "courier:release-post"]); frame.actors.courier = pose(state, mobile ? 58 : 63 - range(p, ...b.courierWalk) * 15, mobile ? 86 : 87, { mode: "visible-height", valueVh: mobile ? 50 : 58 }); }
    if (p >= b.recipientReveal[0] && p < b.combinedHandoff[0]) { const state = stateAt(p, ...b.recipientReveal, ["recipient:neutral", "recipient:ready", "recipient:reach", "recipient:receive-contact"]); frame.actors.recipient = pose(state, mobile ? 27 : 28 + range(p, ...b.recipientReveal) * 11, mobile ? 86 : 87, { mode: "visible-height", valueVh: mobile ? 48 : 57 }); }
    if (p >= b.combinedHandoff[0] && p < b.separation[1]) { const state = p < b.separation[0] ? stateAt(p, ...b.combinedHandoff, ["handoff:approach-gap", "handoff:handoff-start", "handoff:shared-contact", "handoff:transfer-complete", "handoff:post-handoff"]) : "handoff:separation"; frame.actors.handoff = pose(state, mobile ? 49 : 48, mobile ? 86 : 87, { mode: "visible-height", valueVh: mobile ? 55 : 64 }); }
    if (p >= b.separation[1]) { frame.actors.recipient = pose(p < b.courierReturn[0] ? "recipient:after-receive" : "recipient:hold-relaxed", mobile ? 29 : 31, mobile ? 86 : 87, { mode: "visible-height", valueVh: mobile ? 48 : 57 }); if (p < b.vanDoorClose[0]) frame.actors.courier = pose(p < b.courierReturn[0] ? "courier:turn-back" : stateAt(p, ...b.courierReturn, ["courier:return-right-01", "courier:return-right-02"]), mobile ? 58 : 49 + range(p, ...b.courierReturn) * 15, mobile ? 86 : 87, { mode: "visible-height", valueVh: mobile ? 50 : 58 }); }
    frame.handoffProgress = range(p, ...b.combinedHandoff); frame.motionOwner = p < b.vanDoorOpen[0] ? "van" : p < b.courierReveal[0] ? "van-door" : p < b.recipientReveal[0] ? "courier" : p < b.combinedHandoff[0] ? "recipient" : p < b.separation[1] ? "handoff" : p < b.vanDoorClose[0] ? "van-return" : "van-door"; return frame;
  }
  if (chapter === "finale") { frame.brandProgress = range(p, ...HOME_BEATS.finale.brandRise); frame.utilityProgress = range(p, ...HOME_BEATS.finale.utilityReveal); frame.legalProgress = range(p, ...HOME_BEATS.finale.legalReveal); frame.motionOwner = p < HOME_BEATS.finale.brandRise[0] ? "none" : p < HOME_BEATS.finale.utilityReveal[0] ? "finale-brand" : "finale-utility"; }
  return frame;
}
