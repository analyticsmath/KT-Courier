import type { HomeChapter } from "./home-chapters";
import { HOME_CHAPTERS } from "./home-chapters";
import { before, clamp01, HOME_BEATS, range, within } from "./home-beats";
import { HERO_TRUCK_SEQUENCE, RED_TRUCK_STATES, VAN_STATES } from "../../actors/actor-state-machine";
import { visualOwnership, type VisualOwner } from "./home-visual-ownership";
import { actorTargetForOffscreenEdge } from "./home-marketplace-geometry";

export const ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG = 180;

export function routeTruckRotationForTangent(tangentDeg: number): number {
  return tangentDeg + ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG;
}

export type CameraMode =
  | "editorial-side"
  | "market-horizontal"
  | "documentary"
  | "split-custody"
  | "route-overhead"
  | "freight-side"
  | "arrival-human";

export type FocusCorridor = "left-lower" | "center-lower" | "center" | "center-vertical" | "right-center";

export type ActorSizeMode =
  | { mode: "width"; widthVw: number }
  | { mode: "visible-height"; visibleHeightVh: number };

export type ActorFrame = {
  state: string;
  visible: boolean;
  /** Contact point in viewport fractions; groundContact metadata aligns the image to it. */
  targetX: number;
  groundY: number;
  widthVw: number;
  sizeMode?: ActorSizeMode;
  blendToState?: string;
  stateBlend?: number;
  rotation: number;
  scale: number;
};

export interface HomeFrame {
  chapter: HomeChapter;
  chapterProgress: number;
  headerTone: "light" | "dark";
  world: {
    owner: HomeChapter;
    incoming: HomeChapter | null;
    outgoing: HomeChapter | null;
    blend: number;
    cameraMode: CameraMode;
    focus: FocusCorridor;
  };
  selection: { marketplaceId: string | null };
  actors: {
    whiteTruck: ActorFrame;
    van: ActorFrame;
    courier: ActorFrame;
    redTruck: ActorFrame;
  };
  occlusion: { id: string | null; progress: number; requiredCoverage: number };
  /** Compatibility projection used by the existing DOM director. */
  transition: { owner: string | null; progress: number; occlusion: string | null };
  marketplace: {
    activeIndex: number;
    activeId: string | null;
    incomingId: string | null;
    moveProgress: number;
    holdProgress: number;
    positionIndex: number;
    backdropProgress: number;
    backdropIndex: number;
    motionOwner: "none" | "market-rail" | "market-backdrop";
  };
  fan: { phase: "hidden" | "spread" | "compress" | "selected" | "parcel-transfer"; progress: number; selectedId: string | null };
  route: { pathProgress: number; tangentAngle: number };
  visual: { primaryOwner: VisualOwner; incomingOwner?: VisualOwner };
  motionOwner:
    | "none" | "market-rail" | "market-backdrop" | "fan-support" | "fan-transfer"
    | "van" | "van-door" | "courier" | "route-truck" | "freight-truck"
    | "freight-services" | "arrival-image" | "finale-brand";
  sceneOwnership: { previous: HomeChapter | null; current: HomeChapter; next: HomeChapter | null };
}

export interface HomeFrameInput {
  chapter: HomeChapter;
  progress: number;
  viewportMode: "mobile" | "desktop";
  marketplaceCategories?: ReadonlyArray<{ id: string }>;
}

const hidden = (state: string): ActorFrame => ({
  state,
  visible: false,
  targetX: 0.5,
  groundY: 0.86,
  widthVw: 60,
  rotation: 0,
  scale: 1,
});

const interpolate = (from: number, to: number, amount: number) => from + (to - from) * amount;
const smooth = (progress: number) => progress * progress * (3 - 2 * progress);

function resolveHeroSequencePosition(progress: number): number {
  const beats = HOME_BEATS.hero;
  if (progress < beats.travellingTurn[0]) return 0;
  if (progress < beats.travellingTurn[1]) {
    return interpolate(0, 5, smooth(range(progress, beats.travellingTurn[0], beats.travellingTurn[1])));
  }
  if (progress < beats.centreTurn[0]) return 5;
  if (progress < beats.centreTurn[1]) {
    return interpolate(5, 7.76, smooth(range(progress, beats.centreTurn[0], beats.centreTurn[1])));
  }
  if (progress < beats.frontalBlend[1]) {
    return interpolate(7.76, 8, smooth(range(progress, beats.frontalBlend[0], beats.frontalBlend[1])));
  }
  if (progress < beats.frontalEstablish[1]) return 8;
  if (progress < beats.frontalApproach[1]) {
    return interpolate(8, 9, smooth(range(progress, beats.frontalApproach[0], beats.frontalApproach[1])));
  }
  if (progress < beats.closeApproach[1]) {
    return interpolate(9, 10, smooth(range(progress, beats.closeApproach[0], beats.closeApproach[1])));
  }
  if (progress < beats.cameraPass[1]) {
    return interpolate(10, 11, smooth(range(progress, beats.cameraPass[0], beats.cameraPass[1])));
  }
  return 11;
}

function resolveHeroVisibleHeight(progress: number, viewportMode: "mobile" | "desktop"): number {
  const mobile = viewportMode === "mobile";
  const beats = HOME_BEATS.hero;
  const value = (start: number, end: number, from: number, to: number) =>
    interpolate(from, to, smooth(range(progress, start, end)));

  if (progress < beats.travellingTurn[0]) return value(beats.entryReveal[0], beats.entryReveal[1], mobile ? 20 : 22, mobile ? 24 : 29);
  if (progress < beats.travellingTurn[1]) return value(beats.travellingTurn[0], beats.travellingTurn[1], mobile ? 24 : 29, mobile ? 32 : 34);
  if (progress < beats.centreSettle[1]) return mobile ? 36 : 34;
  if (progress < beats.centreTurn[1]) return value(beats.centreTurn[0], beats.centreTurn[1], mobile ? 36 : 34, mobile ? 42 : 40);
  if (progress < beats.frontalEstablish[1]) return mobile ? 42 : 40;
  if (progress < beats.frontalApproach[1]) return value(beats.frontalApproach[0], beats.frontalApproach[1], mobile ? 42 : 40, mobile ? 58 : 58);
  if (progress < beats.closeApproach[1]) return value(beats.closeApproach[0], beats.closeApproach[1], mobile ? 58 : 58, mobile ? 82 : 78);
  if (progress < beats.cameraPass[1]) return value(beats.cameraPass[0], beats.cameraPass[1], mobile ? 82 : 78, mobile ? 112 : 112);
  return value(beats.release[0], beats.release[1], mobile ? 112 : 112, mobile ? 124 : 138);
}

export function resolveHeroTruckFrame(
  progress: number,
  viewportMode: "mobile" | "desktop",
): ActorFrame {
  const p = clamp01(progress);
  const beats = HOME_BEATS.hero;
  const position = resolveHeroSequencePosition(p);
  const index = Math.min(HERO_TRUCK_SEQUENCE.length - 1, Math.floor(position));
  const fraction = position - index;
  const nextIndex = Math.min(HERO_TRUCK_SEQUENCE.length - 1, index + 1);
  const blend = nextIndex === index ? 0 : smooth(range(fraction, 0.76, 1));
  let targetX = interpolate(-0.26, 0.25, smooth(range(p, beats.entryReveal[0], beats.entryReveal[1])));

  if (p >= beats.travellingTurn[0]) {
    targetX = interpolate(0.25, 0.5, smooth(range(p, beats.travellingTurn[0], beats.travellingTurn[1])));
  }
  if (p >= beats.centreSettle[0]) {
    targetX = interpolate(0.5, 0.49, smooth(range(p, beats.centreSettle[0], beats.centreSettle[1])));
  }
  if (p >= beats.centreTurn[1]) targetX = interpolate(0.49, 0.5, smooth(range(p, beats.centreTurn[1], 1)));

  return {
    state: HERO_TRUCK_SEQUENCE[index],
    blendToState: HERO_TRUCK_SEQUENCE[nextIndex],
    stateBlend: blend,
    visible: p >= beats.entryReveal[0] && p < 1,
    targetX,
    groundY: viewportMode === "mobile" ? 0.85 : 0.88,
    widthVw: 60,
    sizeMode: { mode: "visible-height", visibleHeightVh: resolveHeroVisibleHeight(p, viewportMode) },
    rotation: 0,
    scale: 1,
  };
}

function resolveMarketplace(progress: number, categories: ReadonlyArray<{ id: string }>) {
  const count = categories.length;
  if (!count) {
    return { activeIndex: 0, activeId: null, incomingId: null, moveProgress: 0, holdProgress: 0, positionIndex: 0, backdropProgress: 0, backdropIndex: 0, motionOwner: "none" as const };
  }
  if (count === 1) return { activeIndex: 0, activeId: categories[0]?.id ?? null, incomingId: null, moveProgress: 0, holdProgress: 1, positionIndex: 0, backdropProgress: 0, backdropIndex: 0, motionOwner: "none" as const };
  const transitionPosition = clamp01(progress) * (count - 1);
  const segment = Math.min(count - 2, Math.floor(transitionPosition));
  const local = progress === 1 ? 1 : transitionPosition - segment;
  const incomingIndex = segment + 1;
  const railMove = range(local, HOME_BEATS.marketplace.railMove[0], HOME_BEATS.marketplace.railMove[1]);
  const backdropProgress = range(local, HOME_BEATS.marketplace.backdropTakeover[0], HOME_BEATS.marketplace.backdropTakeover[1]);
  const railIsMoving = local >= HOME_BEATS.marketplace.railMove[0] && local < HOME_BEATS.marketplace.railMove[1];
  const backdropIsMoving = local >= HOME_BEATS.marketplace.backdropTakeover[0] && local < HOME_BEATS.marketplace.backdropTakeover[1];
  const activeIndex = local >= HOME_BEATS.marketplace.railSettle[0] ? incomingIndex : segment;
  const positionIndex = local < HOME_BEATS.marketplace.railMove[0]
    ? segment
    : local < HOME_BEATS.marketplace.railSettle[0]
      ? interpolate(segment, incomingIndex, smooth(railMove))
      : incomingIndex;
  const inHold = local < HOME_BEATS.marketplace.railMove[0] || local >= HOME_BEATS.marketplace.readIncoming[0];
  return {
    activeIndex,
    activeId: categories[activeIndex]?.id ?? null,
    incomingId: categories[incomingIndex]?.id ?? null,
    moveProgress: railMove,
    holdProgress: inHold ? range(local, local < 0.2 ? 0 : 0.88, local < 0.2 ? 0.2 : 1) : 0,
    positionIndex,
    backdropProgress,
    backdropIndex: local >= HOME_BEATS.marketplace.readIncoming[0] ? incomingIndex : segment,
    motionOwner: railIsMoving ? "market-rail" : backdropIsMoving ? "market-backdrop" : "none" as const,
  };
}

function worldForChapter(chapter: HomeChapter, progress: number) {
  const transitions: Partial<Record<HomeChapter, { next: HomeChapter; start: number; end: number; owner: string }>> = {
    marketplace: { next: "fan", start: 0.94, end: 1, owner: "market-fan-handoff" },
    fan: { next: "preparation", start: 0.93, end: 1, owner: "fan-parcel-handoff" },
    preparation: { next: "collection", start: 0.84, end: 1, owner: "preparation-collection-handoff" },
    collection: { next: "custody", start: 0.94, end: 1, owner: "collection-custody-handoff" },
    custody: { next: "route", start: 0.72, end: 1, owner: "custody-route-handoff" },
    route: { next: "freight", start: 0.94, end: 1, owner: "route-freight-handoff" },
    freight: { next: "arrival", start: 0.92, end: 1, owner: "freight-arrival-handoff" },
    arrival: { next: "finale", start: 0.92, end: 1, owner: "arrival-footer-handoff" },
  };
  const transition = transitions[chapter];
  const blend = transition ? range(progress, transition.start, transition.end) : 0;
  const owner = transition && blend >= 0.55 ? transition.next : chapter;
  return {
    owner,
    incoming: transition?.next ?? null,
    outgoing: transition ? chapter : null,
    blend,
    transitionOwner: transition && blend > 0 ? transition.owner : null,
  };
}

const CAMERA_BY_CHAPTER: Record<HomeChapter, CameraMode> = {
  hero: "editorial-side",
  marketplace: "market-horizontal",
  fan: "market-horizontal",
  preparation: "documentary",
  collection: "documentary",
  custody: "split-custody",
  route: "route-overhead",
  freight: "freight-side",
  arrival: "arrival-human",
  finale: "editorial-side",
};

const FOCUS_BY_CHAPTER: Record<HomeChapter, FocusCorridor> = {
  hero: "center-lower",
  marketplace: "center",
  fan: "center",
  preparation: "left-lower",
  collection: "left-lower",
  custody: "center-vertical",
  route: "center-vertical",
  freight: "center-lower",
  arrival: "right-center",
  finale: "center",
};

function headerToneForOwner(owner: HomeChapter): HomeFrame["headerTone"] {
  return ["marketplace", "fan", "custody", "route", "freight", "finale"].includes(owner) ? "dark" : "light";
}

export function resolveHomeFrame(input: HomeFrameInput): HomeFrame {
  const progress = clamp01(input.progress);
  const chapterIndex = HOME_CHAPTERS.indexOf(input.chapter);
  const categories = input.marketplaceCategories ?? [];
  const marketplace = resolveMarketplace(progress, categories);
  const selectedMarketplaceId = categories.at(-1)?.id ?? null;
  const selectionId = input.chapter === "fan"
    ? selectedMarketplaceId
    : input.chapter === "marketplace"
      ? marketplace.activeId
      : selectedMarketplaceId;
  const actors = {
    whiteTruck: hidden(HERO_TRUCK_SEQUENCE[0]),
    van: hidden("collection-side-right"),
    courier: hidden("look-left-approach"),
    redTruck: hidden("side-right"),
  };
  let occlusionId: string | null = null;
  let occlusionProgress = 0;
  let requiredCoverage = 0;
  const worldInfo = worldForChapter(input.chapter, progress);
  const fan: HomeFrame["fan"] = {
    phase: "hidden",
    progress,
    selectedId: selectedMarketplaceId,
  };
  let routePathProgress = 0;

  if (input.chapter === "hero") {
    actors.whiteTruck = resolveHeroTruckFrame(progress, input.viewportMode);
  } else if (input.chapter === "fan") {
    const beats = HOME_BEATS.fan;
    if (before(progress, beats.imageArrives[1])) fan.phase = "spread";
    else if (within(progress, beats.spread[0], beats.fullHold[0])) fan.phase = "spread";
    else if (within(progress, beats.fullHold[0], beats.counterMotion[0])) fan.phase = "spread";
    else if (within(progress, beats.counterMotion[0], beats.compress[0])) fan.phase = "spread";
    else if (within(progress, beats.compress[0], beats.selectedHold[0])) fan.phase = "compress";
    else if (within(progress, beats.selectedHold[0], beats.parcelHandoff[0])) fan.phase = "selected";
    else fan.phase = "parcel-transfer";
  } else if (input.chapter === "collection") {
    const beats = HOME_BEATS.collection;
    if (progress >= beats.vanApproach[0] && progress < 1) {
      const entryX = actorTargetForOffscreenEdge({
        definition: VAN_STATES["collection-side-right"], renderedWidth: 58, viewportWidth: 100, edge: "left", marginPx: 2,
      });
      actors.van = {
        ...actors.van,
        visible: true,
        state: progress >= beats.door[0] ? "collection-door-open-right" : "collection-side-right",
        targetX: progress < beats.brake[0]
          ? interpolate(entryX, 0.57, smooth(range(progress, beats.vanApproach[0], beats.brake[0])))
          : 0.57,
        groundY: 0.85,
        widthVw: 58,
      };
    }
    if (progress >= beats.courierApproach[0] && progress < 1) {
      const walking = range(progress, beats.courierApproach[0], beats.lift[0]);
      actors.courier = {
        ...actors.courier,
        visible: true,
        state: progress >= beats.load[0] ? "loading-unloading" : progress >= beats.lift[0] ? "lift-parcel" : "look-right-approach",
        targetX: progress >= beats.lift[0] ? 0.42 : interpolate(0.33, 0.42, smooth(walking)),
        groundY: 0.85,
        widthVw: 16,
      };
    }
  } else if (input.chapter === "custody") {
    const beats = HOME_BEATS.custody;
    actors.courier = {
      ...actors.courier,
      state: "loading-unloading",
      visible: progress < 0.94,
      targetX: progress < beats.networkOwns[0]
        ? interpolate(0.44, 0.5, smooth(range(progress, beats.approachSeam[0], beats.seamHold[1])))
        : interpolate(0.5, 0.58, smooth(range(progress, beats.networkOwns[0], beats.routePrepared[1]))),
      groundY: 0.86,
      widthVw: 17,
    };
  } else if (input.chapter === "route") {
    const beats = HOME_BEATS.route;
    const state = "top-down-straight";
    routePathProgress = progress < beats.straightTravel[1]
      ? range(progress, beats.straightTravel[0], beats.straightTravel[1]) * 0.24
      : progress < beats.straightHold[1]
        ? 0.24
        : progress < beats.firstApproach[1]
          ? interpolate(0.24, 0.38, range(progress, beats.firstApproach[0], beats.firstApproach[1]))
          : progress < beats.angledTravel[1]
            ? interpolate(0.38, 0.62, range(progress, beats.angledTravel[0], beats.angledTravel[1]))
            : progress < beats.angledHold[1]
              ? 0.62
              : progress < beats.turningReveal[1]
                ? interpolate(0.62, 0.94, range(progress, beats.turningReveal[0], beats.turningReveal[1]))
                : interpolate(0.94, 1, range(progress, beats.freightOverlap[0], 1));
    actors.whiteTruck = {
      ...actors.whiteTruck,
      state,
      visible: progress >= beats.reveal[1] && progress < beats.truckRelease,
      targetX: 0.5,
      groundY: 0.58,
      widthVw: 28,
      rotation: routeTruckRotationForTangent(0),
    };
  } else if (input.chapter === "freight") {
    const beats = HOME_BEATS.freight;
    if (progress >= beats.entry[0] && progress < 1) {
      const entry = range(progress, beats.entry[0], beats.settle[1]);
      const exit = range(progress, beats.release[0], 1);
      const entryX = actorTargetForOffscreenEdge({
        definition: RED_TRUCK_STATES["side-right"], renderedWidth: 62, viewportWidth: 100, edge: "left", marginPx: 2,
      });
      actors.redTruck = {
        ...actors.redTruck,
        state: "side-right",
        visible: progress < 0.985,
        targetX: progress < beats.climaxArrival[0]
          ? interpolate(entryX, 0.86, smooth(entry))
          : progress < beats.release[0]
            ? interpolate(0.86, 0.96, smooth(range(progress, beats.climaxArrival[0], beats.climaxArrival[1])))
            : interpolate(0.96, 1.95, smooth(exit)),
        groundY: 0.85,
        widthVw: progress >= beats.cameraPressure[0] ? interpolate(62, 66, range(progress, beats.cameraPressure[0], beats.climaxArrival[1])) : 62,
      };
    }
  } else if (input.chapter === "arrival") {
    const beats = HOME_BEATS.arrival;
    if (progress >= beats.walkIn[0] && progress < 1) {
      actors.courier = {
        ...actors.courier,
        state: "extending-handoff",
        visible: progress < 0.99,
        targetX: progress >= beats.handoff[0]
          ? 0.73
          : interpolate(0.97, 0.69, smooth(range(progress, beats.walkIn[0], beats.settle[1]))),
        groundY: 0.87,
        widthVw: 16,
      };
    }
  }

  if (input.chapter === "finale") {
    actors.whiteTruck.visible = false;
    actors.van.visible = false;
    actors.courier.visible = false;
    actors.redTruck.visible = false;
  }

  const cameraMode = CAMERA_BY_CHAPTER[input.chapter];
  const focus = FOCUS_BY_CHAPTER[input.chapter];
  const headerTone = headerToneForOwner(worldInfo.owner);
  const transitionOwner = occlusionId ?? worldInfo.transitionOwner;
  const transitionProgress = occlusionId ? occlusionProgress : worldInfo.blend;
  const motionOwner: HomeFrame["motionOwner"] = input.chapter === "marketplace"
    ? marketplace.motionOwner
    : input.chapter === "fan"
      ? progress >= HOME_BEATS.fan.parcelHandoff[0] ? "fan-transfer" : "fan-support"
      : input.chapter === "collection"
        ? progress < HOME_BEATS.collection.door[0] ? "van" : progress < HOME_BEATS.collection.courierApproach[0] ? "van-door" : "courier"
        : input.chapter === "route" ? "route-truck"
          : input.chapter === "freight" ? progress < HOME_BEATS.freight.settle[1] ? "freight-truck" : progress < HOME_BEATS.freight.silhouetteHold[0] ? "freight-services" : "freight-truck"
            : input.chapter === "arrival" ? progress >= HOME_BEATS.arrival.footerRelease[0] ? "finale-brand" : "arrival-image"
              : input.chapter === "finale" ? "finale-brand" : "none";
  return {
    chapter: input.chapter,
    chapterProgress: progress,
    headerTone,
    world: {
      owner: worldInfo.owner,
      incoming: worldInfo.incoming,
      outgoing: worldInfo.outgoing,
      blend: worldInfo.blend,
      cameraMode,
      focus,
    },
    selection: { marketplaceId: selectionId },
    actors,
    occlusion: { id: occlusionId, progress: occlusionProgress, requiredCoverage },
    transition: { owner: transitionOwner, progress: clamp01(transitionProgress), occlusion: occlusionId },
    marketplace,
    fan,
    route: { pathProgress: clamp01(routePathProgress), tangentAngle: 0 },
    visual: visualOwnership(input.chapter),
    motionOwner,
    sceneOwnership: {
      previous: chapterIndex > 0 ? HOME_CHAPTERS[chapterIndex - 1] : null,
      current: input.chapter,
      next: chapterIndex >= 0 && chapterIndex < HOME_CHAPTERS.length - 1
        ? HOME_CHAPTERS[chapterIndex + 1]
        : null,
    },
  };
}
