import type { HomeChapter, PostHeroChapter } from "./home-chapters";
import { RED_TRUCK_STATES, VAN_STATES } from "../../actors/actor-state-machine";
import { clamp01, HOME_BEATS, range } from "./home-beats";
import { routeTruckRotationForTangent } from "./home-frame-resolver";
import { actorTargetForOffscreenEdge } from "./home-marketplace-geometry";

export const JOURNEY_ROAD_OCCLUSION_THRESHOLD = 0.98;

export type MotionOwner =
  | "none"
  | "market-rail"
  | "market-to-prep-strips"
  | "prep-street"
  | "van"
  | "van-door"
  | "courier-approach"
  | "courier-lift"
  | "courier-load"
  | "journey-road"
  | "route-truck"
  | "freight-transition"
  | "freight-truck"
  | "freight-services"
  | "handoff-takeover"
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
  | "red-truck:side-right";

export type PostHeroActorName = "van" | "courier" | "white-truck" | "red-truck";

export const POST_HERO_RESOLVER_ACTOR_STATES: readonly PostHeroActorKey[] = [
  "van:collection-side-right",
  "van:collection-door-open-right",
  "courier:look-right-approach",
  "courier:lift-parcel",
  "courier:loading-unloading",
  "courier:ready-handover",
  "white-truck:top-down-straight",
  "red-truck:side-right",
];

export interface PostHeroActorPose {
  state: PostHeroActorKey;
  visible: boolean;
  xVw: number;
  groundY: number;
  widthVw: number;
  rotation: number;
}

export type PostHeroActorFrames = Record<PostHeroActorName, PostHeroActorPose>;

export interface MarketplaceFrame {
  activeIndex: number;
  positionIndex: number;
  exitProgress: number;
  motionOwner: MotionOwner;
}

export interface PostHeroFrame {
  chapter: HomeChapter;
  progress: number;
  motionOwner: MotionOwner;
  actors: PostHeroActorFrames;
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

function hiddenPose(state: PostHeroActorKey): PostHeroActorPose {
  return { state, visible: false, xVw: 0, groundY: 0, widthVw: 0, rotation: 0 };
}

function initialActors(): PostHeroActorFrames {
  return {
    van: hiddenPose("van:collection-side-right"),
    courier: hiddenPose("courier:look-right-approach"),
    "white-truck": hiddenPose("white-truck:top-down-straight"),
    "red-truck": hiddenPose("red-truck:side-right"),
  };
}

export function resolveMarketplaceFrame(progress: number, categoryCount: number): MarketplaceFrame {
  const p = clamp01(progress);
  const count = Math.max(1, categoryCount);
  const exitProgress = range(p, ...HOME_BEATS.marketplace.exitSlices);

  if (count === 1 || p >= HOME_BEATS.marketplace.categoryTraversal[1]) {
    return {
      activeIndex: count - 1,
      positionIndex: count - 1,
      exitProgress,
      motionOwner: p >= HOME_BEATS.marketplace.exitSlices[0]
        ? "market-to-prep-strips"
        : "none",
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
    exitProgress,
    motionOwner: p >= HOME_BEATS.marketplace.exitSlices[0]
      ? "market-to-prep-strips"
      : moving ? "market-rail" : "none",
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
    actors: initialActors(),
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
    const vanWidth = mobile ? 124 : 62;
    const vanEntryX = actorTargetForOffscreenEdge({
      definition: VAN_STATES["collection-side-right"],
      renderedWidth: vanWidth,
      viewportWidth: 100,
      edge: "left",
      marginPx: 1,
    }) * 100;
    const settledVanX = mobile ? 55 : 55;
    const vanEntry = smooth(range(p, ...beats.vanEntry));
    const vanBrake = smooth(range(p, ...beats.vanBrake));
    const vanX = p < beats.vanEntry[1]
      ? interpolate(vanEntryX, settledVanX, vanEntry)
      : p < beats.vanBrake[1]
        ? interpolate(settledVanX, settledVanX + 1.2, vanBrake)
        : settledVanX + 1.2;

    if (p >= beats.vanEntry[0] && p < beats.routeReveal[0]) {
      frame.actors.van = {
        state: p >= beats.vanDoor[0] ? "van:collection-door-open-right" : "van:collection-side-right",
        visible: true,
        xVw: vanX,
        widthVw: vanWidth,
        groundY: mobile ? 0.8 : 0.84,
        rotation: 0,
      };
    }

    if (p >= beats.courierApproach[0] && p < beats.routeReveal[0]) {
      const courierState: PostHeroActorKey = p >= beats.custodyHold[0]
        ? "courier:ready-handover"
        : p >= beats.parcelLoad[0]
          ? "courier:loading-unloading"
          : p >= beats.courierLift[0]
            ? "courier:lift-parcel"
            : "courier:look-right-approach";
      const approach = smooth(range(p, ...beats.courierApproach));
      frame.actors.courier = {
        state: courierState,
        visible: true,
        xVw: interpolate(mobile ? 12 : 24, mobile ? 42 : 45, approach),
        widthVw: mobile ? 46 : 20,
        groundY: mobile ? 0.8 : 0.84,
        rotation: 0,
      };
    }

    frame.custodyProgress = range(p, ...beats.custodyHold);
    frame.roadReveal = range(p, ...beats.roadGrow);
    frame.routeProgress = range(p, ...beats.routeTravel);
    if (p >= beats.routeReveal[0] && frame.roadReveal >= JOURNEY_ROAD_OCCLUSION_THRESHOLD) {
      frame.actors["white-truck"] = {
        state: "white-truck:top-down-straight",
        visible: true,
        xVw: interpolate(mobile ? -4 : -3, 104, smooth(range(p, ...beats.routeReveal))),
        widthVw: mobile ? 28 : 15,
        groundY: interpolate(0.72, 0.28, smooth(frame.routeProgress)),
        rotation: routeTruckRotationForTangent(-20),
      };
    }

    if (p >= beats.vanEntry[0] && p < beats.vanEntry[1]) frame.motionOwner = "van";
    else if (p >= beats.vanDoor[0] && p < beats.courierApproach[0]) frame.motionOwner = "van-door";
    else if (p >= beats.courierApproach[0] && p < beats.courierLift[0]) frame.motionOwner = "courier-approach";
    else if (p >= beats.courierLift[0] && p < beats.parcelLoad[0]) frame.motionOwner = "courier-lift";
    else if (p >= beats.parcelLoad[0] && p < beats.custodyHold[1]) frame.motionOwner = "courier-load";
    else if (p >= beats.roadGrow[0] && p < beats.routeReveal[0]) frame.motionOwner = "journey-road";
    else if (p >= beats.routeReveal[0]) frame.motionOwner = "route-truck";
    return frame;
  }

  if (chapter === "freight") {
    const beats = HOME_BEATS.freight;
    if (p < beats.routeContinuation[1]) {
      const exit = smooth(range(p, ...beats.routeContinuation));
      frame.actors["white-truck"] = {
        state: "white-truck:top-down-straight",
        visible: true,
        xVw: interpolate(88, 104, exit),
        widthVw: mobile ? 28 : 15,
        groundY: interpolate(0.28, 0.17, exit),
        rotation: routeTruckRotationForTangent(-10),
      };
    }

    const truckWidth = mobile ? 136 : 72;
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
      truckX = interpolate(settledX, mobile ? 164 : 146, smooth(range(p, ...beats.truckResume)));
    } else if (p >= beats.truckResume[1]) {
      truckX = mobile ? 164 : 146;
    }

    if (p >= beats.truckEntry[0] && p < beats.destinationTakeover[0]) {
      frame.actors["red-truck"] = {
        state: "red-truck:side-right",
        visible: true,
        xVw: truckX,
        widthVw: truckWidth,
        groundY: mobile ? 0.76 : 0.74,
        rotation: 0,
      };
    }
    frame.servicesProgress = range(p, ...beats.servicesRise);
    frame.destinationProgress = range(p, ...beats.destinationTakeover);

    if (p < beats.environment[1]) frame.motionOwner = "freight-transition";
    else if (p >= beats.truckEntry[0] && p < beats.truckBrake[1]) frame.motionOwner = "freight-truck";
    else if (p >= beats.servicesRise[0] && p < beats.servicesRise[1]) frame.motionOwner = "freight-services";
    else if (p >= beats.truckResume[0] && p < beats.truckResume[1]) frame.motionOwner = "freight-truck";
    else if (p >= beats.destinationTakeover[0]) frame.motionOwner = "handoff-takeover";
    return frame;
  }

  if (chapter === "finale") {
    const beats = HOME_BEATS.finale;
    frame.handoffProgress = range(p, ...beats.arrivalWorld);
    frame.brandProgress = range(p, ...beats.brandRise);
    frame.utilityProgress = range(p, ...beats.utilityReveal);
    frame.legalProgress = range(p, ...beats.legalReveal);
    if (p >= beats.brandRise[0] && p < beats.utilityReveal[0]) frame.motionOwner = "finale-brand";
    if (p >= beats.utilityReveal[0]) frame.motionOwner = "finale-utility";
  }

  return frame;
}
