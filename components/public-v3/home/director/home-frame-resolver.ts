import type { HomeChapter } from "./home-chapters";
import { HOME_CHAPTERS } from "./home-chapters";
import { after, before, clamp01, HOME_BEATS, HOME_LAYOUT, range, within } from "./home-beats";

export type CameraMode =
  | "editorial-side"
  | "market-horizontal"
  | "documentary"
  | "split-custody"
  | "route-overhead"
  | "freight-side"
  | "arrival-human";

export type FocusCorridor = "left-lower" | "center-lower" | "center" | "center-vertical" | "right-center";

export type ActorFrame = {
  state: string;
  visible: boolean;
  /** Contact point in viewport fractions; groundContact metadata aligns the image to it. */
  targetX: number;
  groundY: number;
  widthVw: number;
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
  };
  fan: { phase: "hidden" | "spread" | "compress" | "selected" | "parcel-transfer"; progress: number; selectedId: string | null };
  route: { pathProgress: number; tangentAngle: number };
  sceneOwnership: { previous: HomeChapter | null; current: HomeChapter; next: HomeChapter | null };
}

export interface HomeFrameInput {
  chapter: HomeChapter;
  progress: number;
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

function resolveMarketplace(progress: number, categories: ReadonlyArray<{ id: string }>) {
  const count = categories.length;
  if (!count) {
    return { activeIndex: 0, activeId: null, incomingId: null, moveProgress: 0, holdProgress: 0, positionIndex: 0 };
  }
  const segmentPosition = clamp01(progress) * count;
  const segment = Math.min(count - 1, Math.floor(segmentPosition));
  const local = progress === 1 ? 1 : segmentPosition - segment;
  let moveProgress = 0;
  let positionIndex = segment;
  let activeIndex = segment;
  let incomingId: string | null = null;

  if (segment > 0 && local < 0.24) {
    moveProgress = range(local, 0, 0.24);
    positionIndex = interpolate(segment - 1, segment, smooth(moveProgress));
    activeIndex = moveProgress >= HOME_BEATS.marketplace.ownerThreshold ? segment : segment - 1;
  } else if (segment < count - 1 && local >= 0.72) {
    moveProgress = range(local, 0.72, 1);
    positionIndex = interpolate(segment, segment + 1, smooth(moveProgress));
    incomingId = categories[segment + 1]?.id ?? null;
    activeIndex = moveProgress >= HOME_BEATS.marketplace.ownerThreshold ? segment + 1 : segment;
  }

  const inHold = segment === 0
    ? local >= 0.24 && local < 0.72
    : local >= 0.24 && local < 0.72;
  return {
    activeIndex,
    activeId: categories[activeIndex]?.id ?? null,
    incomingId,
    moveProgress,
    holdProgress: inHold ? range(local, 0.24, 0.72) : 0,
    positionIndex,
  };
}

function worldForChapter(chapter: HomeChapter, progress: number) {
  const transitions: Partial<Record<HomeChapter, { next: HomeChapter; start: number; end: number; owner: string }>> = {
    hero: { next: "marketplace", start: 0.86, end: 1, owner: "hero-cargo-handoff" },
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
    whiteTruck: hidden("side-right"),
    van: hidden("side-left"),
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
    const hero = HOME_BEATS.hero;
    const truckPath = HOME_LAYOUT.heroTruckPath;
    if (within(progress, hero.truckApproach[0], hero.suspensionSettle[0])) {
      const approach = range(progress, hero.truckApproach[0], hero.suspensionSettle[0]);
      actors.whiteTruck = {
        ...actors.whiteTruck,
        state: "front-3q-right",
        visible: true,
        targetX: interpolate(truckPath.arrivalX[0], truckPath.holdX, smooth(approach)),
        groundY: 0.9,
        widthVw: interpolate(54, 62, approach),
      };
    }
    if (within(progress, hero.suspensionSettle[0], hero.suspensionSettle[1])) {
      const registration = range(progress, hero.suspensionSettle[0], hero.suspensionSettle[1]);
      actors.whiteTruck = {
        ...actors.whiteTruck,
        state: registration < 0.5 ? "side-right" : "wide-hero",
        visible: false,
        targetX: truckPath.holdX,
        groundY: 0.9,
        widthVw: registration < 0.5 ? 70 : 72,
      };
      occlusionId = "hero-typography-mask";
      occlusionProgress = registration;
      requiredCoverage = 0.9;
    }
    if (progress >= hero.suspensionSettle[1] && progress < hero.cargoLock[0]) {
      const departure = range(progress, hero.accelerate[0], hero.trailerDominance[1]);
      actors.whiteTruck = {
        ...actors.whiteTruck,
        state: "wide-hero",
        visible: true,
        targetX: progress < hero.accelerate[0]
          ? truckPath.holdX
          : interpolate(truckPath.holdX, truckPath.cargoX, smooth(departure)),
        groundY: 0.9,
        widthVw: 72,
      };
    }
    if (progress >= hero.cargoLock[0]) {
      actors.whiteTruck = {
        ...actors.whiteTruck,
        state: "cargo-box-close",
        visible: false,
        targetX: truckPath.cargoX,
        groundY: 0.9,
        widthVw: 90,
      };
      occlusionId = "hero-cargo-mask";
      occlusionProgress = range(progress, hero.cargoLock[0], hero.oneToThree[0]);
      requiredCoverage = 0.9;
    }
    if (progress >= hero.oneToThree[0]) {
      actors.whiteTruck.visible = false; // Cargo material has expanded over the complete actor before release.
      occlusionProgress = range(progress, hero.cargoLock[0], hero.oneToThree[0]);
      requiredCoverage = 0.9;
    }
  } else if (input.chapter === "marketplace") {
    if (progress >= 0.94) {
      occlusionId = "market-to-fan-card-mask";
      occlusionProgress = range(progress, 0.94, 1);
      requiredCoverage = 0.85;
    }
  } else if (input.chapter === "fan") {
    const beats = HOME_BEATS.fan;
    if (before(progress, beats.imageArrives[1])) fan.phase = "spread";
    else if (within(progress, beats.spread[0], beats.fullHold[0])) fan.phase = "spread";
    else if (within(progress, beats.compress[0], beats.selectedHold[0])) fan.phase = "compress";
    else if (within(progress, beats.selectedHold[0], beats.contract[0])) fan.phase = "selected";
    else fan.phase = "parcel-transfer";
    if (progress >= beats.parcelHandoff[0]) {
      occlusionId = "fan-parcel-mask";
      occlusionProgress = range(progress, beats.parcelHandoff[0], 1);
      requiredCoverage = 0.85;
    }
  } else if (input.chapter === "collection") {
    const beats = HOME_BEATS.collection;
    if (progress >= beats.vanApproach[0] && progress < 1) {
      const approach = range(progress, beats.vanApproach[0], beats.vanHold[0]);
      actors.van = {
        ...actors.van,
        visible: true,
        state: "side-left",
        targetX: progress < beats.vanHold[0] ? interpolate(0.18, 0.57, smooth(approach)) : 0.57,
        groundY: 0.85,
        widthVw: 58,
      };
    }
    if (progress >= beats.courierApproach[0] && progress < 1) {
      const walking = range(progress, beats.courierApproach[0], beats.lift[0]);
      actors.courier = {
        ...actors.courier,
        visible: true,
        state: progress >= beats.load[0] ? "loading-unloading" : progress >= beats.lift[0] ? "lift-parcel" : "look-left-approach",
        targetX: progress >= beats.lift[0] ? 0.42 : interpolate(0.38, 0.42, smooth(walking)),
        groundY: 0.85,
        widthVw: 16,
      };
    }
    if (within(progress, beats.liftMask[0], beats.liftMask[1])) {
      occlusionId = "parcel-mask";
      occlusionProgress = range(progress, beats.liftMask[0], beats.liftMask[1]);
      requiredCoverage = 0.9;
    } else if (within(progress, beats.loadMask[0], beats.loadMask[1])) {
      occlusionId = "parcel-mask";
      occlusionProgress = range(progress, beats.loadMask[0], beats.loadMask[1]);
      requiredCoverage = 0.9;
    } else if (progress >= beats.resolved[0]) {
      occlusionId = "custody-seam-mask";
      occlusionProgress = range(progress, beats.resolved[0], 1);
      requiredCoverage = 0.9;
    }
  } else if (input.chapter === "custody") {
    const beats = HOME_BEATS.custody;
    if (progress >= beats.roadEnters[0]) {
      occlusionId = "route-overpass-a";
      occlusionProgress = range(progress, beats.roadEnters[0], 1);
      requiredCoverage = 0.9;
    }
  } else if (input.chapter === "route") {
    const beats = HOME_BEATS.route;
    const state = progress < beats.firstSwap[0]
      ? "top-down-straight"
      : progress < beats.secondSwap[0]
        ? "top-down-angled"
        : "top-down-turning";
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
      rotation: 0,
    };
    if (within(progress, beats.firstOcclusion[0], beats.firstOcclusion[1])) {
      occlusionId = "route-overpass-a";
      occlusionProgress = range(progress, beats.firstOcclusion[0], beats.firstOcclusion[1]);
      requiredCoverage = 0.92;
    } else if (within(progress, beats.secondOcclusion[0], beats.secondOcclusion[1])) {
      occlusionId = "route-overpass-b";
      occlusionProgress = range(progress, beats.secondOcclusion[0], beats.secondOcclusion[1]);
      requiredCoverage = 0.92;
    } else if (progress >= beats.freightOverlap[0]) {
      occlusionId = "route-terminal-mask";
      occlusionProgress = range(progress, beats.freightOverlap[0], beats.truckRelease);
      requiredCoverage = 0.92;
    }
  } else if (input.chapter === "freight") {
    const beats = HOME_BEATS.freight;
    if (progress >= beats.entry[0] && progress < 1) {
      const entry = range(progress, beats.entry[0], beats.settle[1]);
      const exit = range(progress, beats.release[0], 1);
      actors.redTruck = {
        ...actors.redTruck,
        state: "side-right",
        visible: progress < 0.985,
        targetX: progress < beats.climaxArrival[0]
          ? interpolate(0.04, 0.86, smooth(entry))
          : progress < beats.release[0]
            ? interpolate(0.86, 0.96, smooth(range(progress, beats.climaxArrival[0], beats.climaxArrival[1])))
            : interpolate(0.96, 1.95, smooth(exit)),
        groundY: 0.85,
        widthVw: progress >= beats.cameraPressure[0] ? interpolate(62, 66, range(progress, beats.cameraPressure[0], beats.climaxArrival[1])) : 62,
      };
    }
    if (progress >= beats.release[0]) {
      occlusionId = "freight-gate-mask";
      occlusionProgress = range(progress, beats.release[0], 1);
      requiredCoverage = 0.9;
    }
  } else if (input.chapter === "arrival") {
    const beats = HOME_BEATS.arrival;
    if (progress >= beats.walkIn[0] && progress < 1) {
      actors.courier = {
        ...actors.courier,
        state: progress >= beats.handoff[0] ? "extending-handoff" : "walk-left-one-parcel",
        visible: progress < 0.99,
        targetX: progress >= beats.handoff[0]
          ? 0.73
          : interpolate(0.97, 0.69, smooth(range(progress, beats.walkIn[0], beats.settle[1]))),
        groundY: 0.87,
        widthVw: 16,
      };
    }
    if (within(progress, beats.handoffMask[0], beats.handoffMask[1])) {
      occlusionId = "arrival-architecture-mask";
      occlusionProgress = range(progress, beats.handoffMask[0], beats.handoffMask[1]);
      requiredCoverage = 0.9;
    } else if (progress >= beats.footerRelease[0]) {
      occlusionId = "arrival-architecture-mask";
      occlusionProgress = range(progress, beats.footerRelease[0], beats.footerRelease[1]);
      requiredCoverage = 0.9;
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
    sceneOwnership: {
      previous: chapterIndex > 0 ? HOME_CHAPTERS[chapterIndex - 1] : null,
      current: input.chapter,
      next: chapterIndex >= 0 && chapterIndex < HOME_CHAPTERS.length - 1
        ? HOME_CHAPTERS[chapterIndex + 1]
        : null,
    },
  };
}
