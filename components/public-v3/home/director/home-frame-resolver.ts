import { HERO_TRUCK_SEQUENCE } from "../../actors/actor-state-machine";
import { clamp01, HOME_BEATS, range } from "./home-beats";

export const ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG = 180;

export function routeTruckRotationForTangent(tangentDeg: number): number {
  return tangentDeg + ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG;
}

export type ActorFrame = {
  state: string;
  visible: boolean;
  targetX: number;
  groundY: number;
  widthVw: number;
  sizeMode?: { mode: "width"; widthVw: number } | { mode: "visible-height"; visibleHeightVh: number };
  blendToState?: string;
  stateBlend?: number;
  rotation: number;
  scale: number;
};

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smooth(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

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
  return value(beats.release[0], beats.release[1], 112, mobile ? 124 : 138);
}

/** Kept byte-for-byte equivalent in behavior to the accepted Hero actor resolver. */
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
