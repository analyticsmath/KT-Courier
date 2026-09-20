import type { HomeChapter } from "./home-chapters";
import { HOME_CHAPTERS } from "./home-chapters";
import { after, before, clamp01, HOME_BEATS, HOME_LAYOUT, range, within } from "./home-beats";

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
  actors: {
    whiteTruck: ActorFrame;
    van: ActorFrame;
    courier: ActorFrame;
    redTruck: ActorFrame;
  };
  transition: { owner: string | null; progress: number; occlusion: string | null };
  marketplace: {
    activeIndex: number;
    activeId: string | null;
    moveProgress: number;
    holdProgress: number;
    positionIndex: number;
  };
  fan: { phase: "hidden" | "spread" | "compress" | "selected" | "parcel-transfer"; progress: number };
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
  groundY: 0.9,
  widthVw: 70,
  rotation: 0,
  scale: 1,
});

const interpolate = (from: number, to: number, amount: number) => from + (to - from) * amount;

function resolveMarketplace(progress: number, categories: ReadonlyArray<{ id: string }>) {
  const count = Math.max(1, categories.length);
  const segmentPosition = clamp01(progress) * count;
  const segment = Math.min(count - 1, Math.floor(segmentPosition));
  const local = segment === count - 1 && progress === 1 ? 1 : segmentPosition - segment;
  const moving = segment < count - 1 && local >= HOME_BEATS.marketplace.segmentHold;
  const moveProgress = moving
    ? range(local, HOME_BEATS.marketplace.segmentHold, 1)
    : 0;
  const positionIndex = segment + moveProgress;
  const activeIndex = Math.min(count - 1, Math.max(0, Math.round(positionIndex)));
  const holdProgress = moving ? 0 : range(local, 0, HOME_BEATS.marketplace.segmentHold);
  return {
    activeIndex,
    activeId: categories[activeIndex]?.id ?? null,
    moveProgress,
    holdProgress,
    positionIndex,
  };
}

export function resolveHomeFrame(input: HomeFrameInput): HomeFrame {
  const progress = clamp01(input.progress);
  const chapterIndex = HOME_CHAPTERS.indexOf(input.chapter);
  const categories = input.marketplaceCategories ?? [];
  const marketplace = resolveMarketplace(progress, categories);
  const actors = {
    whiteTruck: hidden("side-right"),
    van: hidden("motion-transition"),
    courier: hidden("look-left-approach"),
    redTruck: hidden("motion-entry"),
  };
  let owner: string | null = null;
  let occlusion: string | null = null;
  let transitionProgress = 0;
  let headerTone: HomeFrame["headerTone"] = "light";
  const fan: HomeFrame["fan"] = { phase: "hidden", progress: 0 };

  if (input.chapter === "hero") {
    const hero = HOME_BEATS.hero;
    const truckPath = HOME_LAYOUT.heroTruckPath;
    if (within(progress, hero.truckApproach[0], hero.suspensionSettle[1])) {
      actors.whiteTruck = {
        ...actors.whiteTruck,
        visible: true,
        targetX: interpolate(truckPath.arrivalX[0], truckPath.holdX, range(progress, hero.truckApproach[0], hero.suspensionSettle[1])),
        groundY: 0.9,
        widthVw: 70,
      };
    }
    if (after(progress, hero.suspensionSettle[0]) && progress < hero.cargoLock[0]) {
      actors.whiteTruck = {
        ...actors.whiteTruck,
        state: "wide-hero",
        visible: true,
        targetX: progress < hero.accelerate[0]
          ? truckPath.holdX
          : progress < hero.trailerDominance[0]
            ? interpolate(truckPath.holdX, truckPath.accelerationX, range(progress, hero.accelerate[0], hero.trailerDominance[0]))
            : interpolate(truckPath.accelerationX, truckPath.cargoX, range(progress, hero.trailerDominance[0], hero.cargoLock[0])),
        groundY: 0.9,
        widthVw: 72,
      };
      if (within(progress, hero.suspensionSettle[0], hero.suspensionSettle[1])) {
        actors.whiteTruck.visible = false;
      }
      if (within(progress, hero.suspensionSettle[0], hero.suspensionSettle[1])) {
        owner = "hero-typography-concealment";
        occlusion = "typography-occlusion";
        transitionProgress = range(progress, hero.suspensionSettle[0], hero.suspensionSettle[1]);
      }
    }
    if (within(progress, hero.cargoLock[0], hero.oneToThree[0])) {
      actors.whiteTruck = { ...actors.whiteTruck, state: "cargo-box-close", visible: false, targetX: truckPath.cargoX, widthVw: 90 };
      owner = "hero-cargo-takeover";
      occlusion = "trailer-takeover";
      transitionProgress = range(progress, hero.cargoLock[0], hero.oneToThree[0]);
    }
    if (after(progress, hero.oneToThree[0])) {
      owner = progress < hero.threeToFive[0]
        ? "hero-one-to-three-aperture"
        : progress < hero.handoff[0]
          ? "hero-three-to-five-field"
          : "marketplace-handoff";
      occlusion = "trailer-takeover";
      transitionProgress = range(progress, hero.cargoLock[0], 1);
    }
  } else if (input.chapter === "marketplace") {
    headerTone = "dark";
  } else if (input.chapter === "fan") {
    headerTone = "dark";
    const beats = HOME_BEATS.fan;
    if (before(progress, beats.imageArrives[1])) fan.phase = "hidden";
    else if (within(progress, beats.spread[0], beats.fullHold[0])) fan.phase = "spread";
    else if (within(progress, beats.compress[0], beats.selectedHold[0])) fan.phase = "compress";
    else if (within(progress, beats.selectedHold[0], beats.contract[0])) fan.phase = "selected";
    else if (after(progress, beats.contract[0])) fan.phase = "parcel-transfer";
    else fan.phase = "spread";
    fan.progress = progress;
    if (after(progress, beats.parcelHandoff[0])) {
      owner = "fan-parcel-handoff";
      occlusion = "parcel-coverage";
      transitionProgress = range(progress, beats.parcelHandoff[0], 1);
    }
  } else if (input.chapter === "collection") {
    const beats = HOME_BEATS.collection;
    if (within(progress, beats.vanApproach[0], beats.brake[1])) {
      actors.van = {
        ...actors.van,
        visible: true,
        state: progress < 0.3 ? "motion-transition" : "side-left",
        targetX: interpolate(0.12, 0.7, range(progress, beats.vanApproach[0], beats.brake[1])),
        groundY: 0.9,
        widthVw: 65,
      };
    }
    if (within(progress, 0.26, 0.32)) {
      actors.van = { ...actors.van, visible: false, state: "side-left" };
      owner = "collection-van-registration";
      occlusion = "scene-boundary";
      transitionProgress = range(progress, 0.26, 0.32);
    }
    if (after(progress, beats.brake[1]) && progress < 1) {
      actors.van = {
        ...actors.van,
        visible: true,
        state: after(progress, beats.door[0]) ? "sliding-door-open" : "side-left",
        targetX: 0.72,
        groundY: 0.9,
        widthVw: 65,
      };
    }
    if (within(progress, beats.door[0], beats.door[1])) {
      owner = "collection-door-event";
      occlusion = "door-sequence";
      transitionProgress = range(progress, beats.door[0], beats.door[1]);
    }
    if (within(progress, beats.courierApproach[0], beats.lift[0])) {
      actors.courier = {
        ...actors.courier,
        visible: true,
        state: "look-left-approach",
        targetX: interpolate(0.59, 0.64, range(progress, beats.courierApproach[0], beats.lift[0])),
        groundY: 0.9,
        widthVw: 19,
      };
    }
    if (within(progress, beats.lift[0], beats.lift[1])) {
      actors.courier = { ...actors.courier, state: "lift-parcel", visible: progress >= beats.lift[0] + 0.01, targetX: 0.64, groundY: 0.9, widthVw: 19 };
      owner = "collection-van-door";
      occlusion = "van-door";
      transitionProgress = range(progress, beats.lift[0], beats.lift[1]);
    }
    if (within(progress, beats.load[0], beats.load[1])) {
      actors.courier = { ...actors.courier, state: "loading-unloading", visible: progress >= beats.load[0] + 0.01, targetX: 0.64, groundY: 0.9, widthVw: 19 };
      owner = "collection-parcel-coverage";
      occlusion = "parcel-coverage";
      transitionProgress = range(progress, beats.load[0], beats.load[1]);
    }
    if (after(progress, beats.load[1])) {
      actors.courier = { ...actors.courier, state: "loading-unloading", visible: true, targetX: 0.67, groundY: 0.89, widthVw: 18 };
      owner = "collection-custody-seam";
      occlusion = "custody-seam";
      transitionProgress = range(progress, beats.load[1], 1);
    }
  } else if (input.chapter === "custody") {
    headerTone = "dark";
    const beats = HOME_BEATS.custody;
    actors.courier = {
      ...actors.courier,
      visible: !within(progress, beats.seamHold[0], beats.seamHold[0] + 0.01),
      state: after(progress, beats.seamHold[0]) ? "ready-handover" : "loading-unloading",
      targetX: interpolate(0.67, 0.48, range(progress, beats.merchant[0], beats.networkOwns[1])),
      groundY: 0.89,
      widthVw: 18,
    };
    if (within(progress, beats.approachSeam[0], beats.networkOwns[0])) {
      owner = "custody-parcel-seam";
      occlusion = "custody-seam";
      transitionProgress = range(progress, beats.approachSeam[0], beats.networkOwns[0]);
    }
    if (within(progress, beats.seamHold[0], beats.networkOwns[0])) {
      owner = "custody-responsibility-hold";
      occlusion = "custody-seam";
      transitionProgress = range(progress, beats.seamHold[0], beats.networkOwns[0]);
    }
    if (after(progress, beats.roadEnters[0])) {
      actors.courier.visible = progress < beats.routePrepared[0];
      owner = "custody-route-preparation";
      occlusion = "road-geometry";
      transitionProgress = range(progress, beats.roadEnters[0], 1);
    }
  } else if (input.chapter === "route") {
    const beats = HOME_BEATS.route;
    const state = progress < beats.firstSwap[0]
      ? "top-down-straight"
      : progress < beats.secondSwap[0]
        ? "top-down-angled"
        : "top-down-turning";
    const covered = within(progress, beats.firstSwap[0], beats.angledReveal[0])
      || within(progress, beats.secondCover[0], beats.turningReveal[0]);
    actors.whiteTruck = {
      ...actors.whiteTruck,
      state,
      visible: progress >= beats.reveal[1] && progress < beats.truckRelease,
      targetX: state === "top-down-straight" ? 0.5 : state === "top-down-angled" ? 0.59 : 0.68,
      groundY: state === "top-down-straight" ? 0.58 : 0.62,
      widthVw: 28,
      rotation: state === "top-down-straight" ? 0 : state === "top-down-angled" ? 18 : 44,
    };
    if (covered) {
      actors.whiteTruck.visible = false;
      owner = progress < beats.angledReveal[0] ? "route-first-overpass" : "route-road-curve";
      occlusion = "overpass-shadow";
      transitionProgress = progress < beats.angledReveal[0]
        ? range(progress, beats.firstOcclusion[0], beats.angledReveal[0])
        : range(progress, beats.secondOcclusion[0], beats.turningReveal[0]);
    }
    if (after(progress, beats.freightOverlap[0])) {
      owner = "route-freight-overlap";
      occlusion = "road-geometry";
      transitionProgress = range(progress, beats.freightOverlap[0], beats.truckRelease);
    }
  } else if (input.chapter === "freight") {
    headerTone = "dark";
    const beats = HOME_BEATS.freight;
    if (within(progress, beats.entry[0], beats.entryOcclusion[1])) {
      actors.redTruck = {
        ...actors.redTruck,
        state: progress < beats.entryOcclusion[0] ? "motion-entry" : "side-right",
        visible: progress < beats.entryOcclusion[0],
        targetX: interpolate(0.05, 0.58, range(progress, beats.entry[0], beats.entryOcclusion[0])),
        groundY: 0.9,
        widthVw: 94,
      };
    }
    if (within(progress, beats.entryOcclusion[0], beats.entryOcclusion[1])) {
      owner = "freight-edge-registration";
      occlusion = "viewport-edge";
      transitionProgress = range(progress, beats.entryOcclusion[0], beats.entryOcclusion[1]);
    }
    if (after(progress, beats.entryOcclusion[1]) && progress < beats.climax[1]) {
      actors.redTruck = {
        ...actors.redTruck,
        state: after(progress, beats.climaxPrep[0]) ? "centered-hero" : "side-right",
        visible: !within(progress, beats.climaxPrep[0], beats.climax[0]),
        targetX: after(progress, beats.climaxPrep[0]) ? 0.52 : interpolate(0.58, 0.84, range(progress, beats.sideTravel[0], beats.silhouetteHold[1])),
        groundY: 0.9,
        widthVw: after(progress, beats.climaxPrep[0]) ? 88 : 82,
      };
    }
    if (within(progress, beats.climaxPrep[0], beats.climax[0])) {
      owner = "freight-climax-registration";
      occlusion = "scene-boundary";
      transitionProgress = range(progress, beats.climaxPrep[0], beats.climax[0]);
      actors.redTruck.state = "centered-hero";
      actors.redTruck.visible = false;
    }
    if (after(progress, beats.release[0])) {
      actors.redTruck.visible = false;
      owner = "freight-arrival-release";
      occlusion = "scene-boundary";
      transitionProgress = range(progress, beats.release[0], 1);
    }
  } else if (input.chapter === "arrival") {
    const beats = HOME_BEATS.arrival;
    const concealed = within(progress, beats.concealedSwap[0], beats.handoff[0]);
    actors.courier = {
      ...actors.courier,
      state: after(progress, beats.handoff[0]) ? "extending-handoff" : "walk-left-one-parcel",
      visible: progress >= beats.walkIn[0],
      targetX: after(progress, beats.handoff[0]) ? 0.72 : interpolate(0.95, 0.62, range(progress, beats.walkIn[0], beats.settle[1])),
      groundY: 0.9,
      widthVw: 17,
    };
    if (concealed) {
      actors.courier.visible = false;
      owner = "arrival-architectural-handoff";
      occlusion = "architectural-mask";
      transitionProgress = range(progress, beats.concealedSwap[0], beats.handoff[0]);
    }
    if (after(progress, beats.handoff[0])) {
      owner = "arrival-human-handoff";
      occlusion = "architectural-mask";
      transitionProgress = range(progress, beats.handoff[0], beats.finalHold[1]);
    }
  }

  if (input.chapter === "finale") {
    // The final horizon owns the frame without a protagonist.
    actors.whiteTruck.visible = false;
    actors.van.visible = false;
    actors.courier.visible = false;
    actors.redTruck.visible = false;
  }

  return {
    chapter: input.chapter,
    chapterProgress: progress,
    headerTone,
    actors,
    transition: { owner, progress: clamp01(transitionProgress), occlusion },
    marketplace,
    fan,
    sceneOwnership: {
      previous: chapterIndex > 0 ? HOME_CHAPTERS[chapterIndex - 1] : null,
      current: input.chapter,
      next: chapterIndex >= 0 && chapterIndex < HOME_CHAPTERS.length - 1
        ? HOME_CHAPTERS[chapterIndex + 1]
        : null,
    },
  };
}
