import type { HomeChapter, PostHeroChapter } from "./home-chapters";
import { RED_TRUCK_STATES, VAN_STATES } from "../../actors/actor-state-machine";
import { clamp01, HOME_BEATS, range } from "./home-beats";
import { routeTruckRotationForTangent } from "./home-frame-resolver";
import { actorTargetForOffscreenEdge } from "./home-marketplace-geometry";

export type MotionOwner =
  | "none"
  | "market-rail"
  | "market-portal"
  | "market-exit-slices"
  | "prep-media"
  | "van"
  | "van-door"
  | "courier-approach"
  | "courier-lift"
  | "journey-road"
  | "route-truck"
  | "freight-truck"
  | "freight-services"
  | "destination-takeover"
  | "arrival-courier"
  | "finale-brand"
  | "finale-utility";

export type PostHeroActorKey =
  | "van:collection-side-right"
  | "van:collection-door-open-right"
  | "courier:look-right-approach"
  | "courier:lift-parcel"
  | "courier:loading-unloading"
  | "courier:ready-handover"
  | "white-truck:top-down-straight"
  | "red-truck:side-right"
  | "courier:extending-handoff";

export const POST_HERO_RESOLVER_ACTOR_STATES: readonly PostHeroActorKey[] = [
  "van:collection-side-right",
  "van:collection-door-open-right",
  "courier:look-right-approach",
  "courier:lift-parcel",
  "courier:loading-unloading",
  "courier:ready-handover",
  "white-truck:top-down-straight",
  "red-truck:side-right",
  "courier:extending-handoff",
];

export interface PostHeroActorPose {
  state: PostHeroActorKey;
  visible: boolean;
  xVw: number;
  widthVw: number;
  groundY: number;
  rotation: number;
}

export interface MarketplaceFrame {
  activeIndex: number;
  positionIndex: number;
  portalProgress: number;
  exitProgress: number;
  motionOwner: MotionOwner;
}

export interface PostHeroFrame {
  chapter: HomeChapter;
  progress: number;
  motionOwner: MotionOwner;
  actors: Partial<Record<"van" | "courier" | "white-truck" | "red-truck", PostHeroActorPose>>;
  marketplace?: MarketplaceFrame;
  prepMediaProgress: number;
  streetReveal: number;
  custodyProgress: number;
  roadReveal: number;
  routeProgress: number;
  servicesProgress: number;
  destinationProgress: number;
  handoffProgress: number;
  brandProgress: number;
  utilityProgress: number;
  legalProgress: number;
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smooth(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

export function resolveMarketplaceFrame(progress: number, categoryCount: number): MarketplaceFrame {
  const p = clamp01(progress);
  const count = Math.max(1, categoryCount);
  const portalProgress = range(p, ...HOME_BEATS.marketplace.portalBuild);
  const exitProgress = range(p, ...HOME_BEATS.marketplace.exitSlices);

  if (count === 1 || p >= HOME_BEATS.marketplace.categoryTraversal[1]) {
    return {
      activeIndex: count - 1,
      positionIndex: count - 1,
      portalProgress,
      exitProgress,
      motionOwner: p >= HOME_BEATS.marketplace.mediaHandoff[0]
        ? "prep-media"
        : p >= HOME_BEATS.marketplace.exitSlices[0]
          ? "market-exit-slices"
          : p >= 0.84 ? "market-portal" : "none",
    };
  }

  const initialHold = 0.12;
  const betweenHold = 0.05;
  const finalHold = 0.05;
  const moveCount = count - 1;
  const moveDuration = Math.max(0.01, (0.84 - initialHold - betweenHold * Math.max(0, count - 2) - finalHold) / moveCount);
  let cursor = initialHold;
  let positionIndex = 0;
  let moving = false;

  if (p >= initialHold) {
    for (let target = 1; target < count; target += 1) {
      const moveEnd = cursor + moveDuration;
      if (p <= moveEnd) {
        positionIndex = (target - 1) + smooth(range(p, cursor, moveEnd));
        moving = p < moveEnd;
        break;
      }
      positionIndex = target;
      cursor = moveEnd;
      const holdEnd = cursor + (target === count - 1 ? finalHold : betweenHold);
      if (p <= holdEnd) break;
      cursor = holdEnd;
    }
  }

  return {
    activeIndex: Math.max(0, Math.min(count - 1, Math.round(positionIndex))),
    positionIndex,
    portalProgress,
    exitProgress,
    motionOwner: p >= HOME_BEATS.marketplace.mediaHandoff[0]
      ? "prep-media"
      : p >= HOME_BEATS.marketplace.exitSlices[0]
        ? "market-exit-slices"
        : p >= 0.84 ? "market-portal" : moving ? "market-rail" : "none",
  };
}

export function resolvePostHeroFrame(
  chapter: PostHeroChapter,
  progress: number,
  viewportMode: "mobile" | "desktop",
): PostHeroFrame {
  const p = clamp01(progress);
  const mobile = viewportMode === "mobile";
  const frame: PostHeroFrame = {
    chapter,
    progress: p,
    motionOwner: "none",
    actors: {},
    prepMediaProgress: chapter === "preparation" ? range(p, ...HOME_BEATS.preparation.mediaTransfer) : 0,
    streetReveal: chapter === "preparation" ? range(p, ...HOME_BEATS.preparation.streetReveal) : 0,
    custodyProgress: 0,
    roadReveal: 0,
    routeProgress: 0,
    servicesProgress: 0,
    destinationProgress: 0,
    handoffProgress: 0,
    brandProgress: 0,
    utilityProgress: 0,
    legalProgress: 0,
  };

  if (chapter === "journey") {
    const beats = HOME_BEATS.journey;
    const vanWidth = mobile ? 124 : 70;
    const vanEntryX = actorTargetForOffscreenEdge({
      definition: VAN_STATES["collection-side-right"],
      renderedWidth: vanWidth,
      viewportWidth: 100,
      edge: "left",
      marginPx: 1,
    }) * 100;
    const vanEndX = mobile ? 46 : 47;
    const vanEntry = smooth(range(p, ...beats.vanEntry));
    const vanX = p < beats.vanBrake[0]
      ? interpolate(vanEntryX, vanEndX, vanEntry)
      : vanEndX;
    const doorOpen = p >= beats.vanDoor[0] && p < beats.roadGrow[1];
    if (p >= beats.vanEntry[0] && p < beats.roadGrow[1]) {
      frame.actors.van = {
        state: doorOpen ? "van:collection-door-open-right" : "van:collection-side-right",
        visible: true,
        xVw: vanX,
        widthVw: vanWidth,
        groundY: mobile ? 0.79 : 0.84,
        rotation: 0,
      };
    }

    if (p >= beats.courierApproach[0] && p < beats.roadGrow[1]) {
      const courierState: PostHeroActorKey = p >= beats.custodyHold[0]
        ? "courier:ready-handover"
        : p >= beats.parcelLoad[0]
          ? "courier:loading-unloading"
          : p >= beats.courierLift[0]
            ? "courier:lift-parcel"
            : "courier:look-right-approach";
      frame.actors.courier = {
        state: courierState,
        visible: true,
        xVw: mobile ? 54 : 58,
        widthVw: mobile ? 48 : 19,
        groundY: mobile ? 0.79 : 0.84,
        rotation: 0,
      };
    }

    frame.custodyProgress = range(p, ...beats.parcelLoad);
    frame.roadReveal = range(p, ...beats.roadGrow);
    frame.routeProgress = range(p, ...beats.routeTravel);
    if (p >= beats.routeReveal[0]) {
      frame.actors["white-truck"] = {
        state: "white-truck:top-down-straight",
        visible: p < 1,
        xVw: interpolate(mobile ? 26 : 20, mobile ? 64 : 72, smooth(frame.routeProgress)),
        widthVw: mobile ? 33 : 28,
        groundY: interpolate(0.63, 0.38, smooth(frame.routeProgress)),
        rotation: routeTruckRotationForTangent(-20),
      };
    }

    if (p < beats.vanEntry[1] && p >= beats.vanEntry[0]) frame.motionOwner = "van";
    else if (p >= beats.vanDoor[0] && p < beats.courierApproach[0]) frame.motionOwner = "van-door";
    else if (p >= beats.courierApproach[0] && p < beats.courierLift[0]) frame.motionOwner = "courier-approach";
    else if (p >= beats.courierLift[0] && p < beats.parcelLoad[0]) frame.motionOwner = "courier-lift";
    else if (p >= beats.roadGrow[0] && p < beats.routeReveal[0]) frame.motionOwner = "journey-road";
    else if (p >= beats.routeReveal[0]) frame.motionOwner = "route-truck";
    return frame;
  }

  if (chapter === "freight") {
    const beats = HOME_BEATS.freight;
    const truckWidth = mobile ? 136 : 68;
    const truckEntryX = actorTargetForOffscreenEdge({
      definition: RED_TRUCK_STATES["side-right"],
      renderedWidth: truckWidth,
      viewportWidth: 100,
      edge: "left",
      marginPx: 1,
    }) * 100;
    const settledX = mobile ? 55 : 45;
    let truckX = settledX;
    if (p < beats.truckEntry[1]) {
      truckX = interpolate(truckEntryX, settledX, smooth(range(p, ...beats.truckEntry)));
    } else if (p >= beats.truckResume[0] && p < beats.truckResume[1]) {
      truckX = interpolate(settledX, mobile ? 160 : 145, smooth(range(p, ...beats.truckResume)));
    }

    if (p >= beats.truckEntry[0] && p < beats.destinationTakeover[1]) {
      frame.actors["red-truck"] = {
        state: "red-truck:side-right",
        visible: p < 0.96,
        xVw: truckX,
        widthVw: truckWidth,
        groundY: mobile ? 0.8 : 0.84,
        rotation: 0,
      };
    }
    frame.servicesProgress = range(p, ...beats.servicesRise);
    frame.destinationProgress = range(p, ...beats.destinationTakeover);
    if (p >= beats.truckEntry[0] && p < beats.truckBrake[1]) frame.motionOwner = "freight-truck";
    else if (p >= beats.servicesRise[0] && p < beats.servicesRise[1]) frame.motionOwner = "freight-services";
    else if (p >= beats.truckResume[0] && p < beats.truckResume[1]) frame.motionOwner = "freight-truck";
    else if (p >= beats.destinationTakeover[0]) frame.motionOwner = "destination-takeover";
    return frame;
  }

  const beats = HOME_BEATS.finale;
  frame.handoffProgress = range(p, ...beats.courierHandoff);
  frame.brandProgress = range(p, ...beats.brandRise);
  frame.utilityProgress = range(p, ...beats.utilityReveal);
  frame.legalProgress = range(p, ...beats.legalReveal);
  if (p >= beats.arrivalFade[0] && p < beats.utilityReveal[0]) {
    frame.motionOwner = "finale-brand";
  }
  if (p >= beats.courierHandoff[0] && p < beats.brandRise[0]) {
    frame.actors.courier = {
      state: "courier:extending-handoff",
      visible: true,
      xVw: interpolate(mobile ? 113 : 108, mobile ? 58 : 67, smooth(frame.handoffProgress)),
      widthVw: mobile ? 52 : 20,
      groundY: mobile ? 0.81 : 0.85,
      rotation: 0,
    };
    frame.motionOwner = "arrival-courier";
  } else if (p >= beats.brandRise[0] && p < beats.arrivalFade[1]) {
    frame.motionOwner = "finale-brand";
  } else if (p >= beats.utilityReveal[0]) {
    frame.motionOwner = "finale-utility";
  }

  return frame;
}

export function resolveHomeChapter(
  chapter: HomeChapter,
  progress: number,
  viewportMode: "mobile" | "desktop",
): PostHeroFrame | null {
  if (chapter === "hero") return null;
  return resolvePostHeroFrame(chapter, progress, viewportMode);
}
