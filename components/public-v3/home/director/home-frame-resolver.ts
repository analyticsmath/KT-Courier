import { HERO_VAN_SEQUENCE } from "./hero-van-sequence.generated";
import { clamp01, range, smooth } from "./home-beats";

export const ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG = 180;

export function routeTruckRotationForTangent(tangentDeg: number): number {
  return tangentDeg + ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG;
}

export type HeroVanFrame = {
  state: string;
  blendToState?: string;
  stateBlend: number;
  visible: boolean;
  targetX: number;
  groundY: number;
  canvasScale: number;
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easedRange = (p: number, start: number, end: number) => smooth(range(p, start, end));

/** Pure progress-derived hero choreography; reverse scroll needs no separate state. */
export function resolveHeroVanFrame(progress: number, viewportMode: "mobile" | "desktop"): HeroVanFrame {
  const p = clamp01(progress);
  const mobile = viewportMode === "mobile";
  const turnPosition = easedRange(p, .22, .66) * (HERO_VAN_SEQUENCE.length - 1);
  const index = Math.min(HERO_VAN_SEQUENCE.length - 1, Math.floor(turnPosition));
  const nextIndex = Math.min(HERO_VAN_SEQUENCE.length - 1, index + 1);
  const fraction = turnPosition - index;
  const entryT = easedRange(p, .13, .22);
  const turnT = easedRange(p, .22, .66);
  const targetX = p < .22
    ? lerp(mobile ? -.4 : -.28, mobile ? .13 : .2, entryT)
    : lerp(mobile ? .13 : .2, .5, turnT);
  let canvasScale = p < .22
    ? lerp(mobile ? 1.17 : .46, mobile ? 1.3 : .54, entryT)
    : lerp(mobile ? 1.3 : .54, mobile ? 1.5 : .68, turnT);
  if (p >= .7) canvasScale = lerp(mobile ? 1.5 : .68, mobile ? 2.25 : 1.18, easedRange(p, .7, .9));
  if (p >= .9) canvasScale = lerp(mobile ? 2.25 : 1.18, mobile ? 2.9 : 1.7, easedRange(p, .9, .975));
  if (p >= .975) canvasScale = lerp(mobile ? 2.9 : 1.7, mobile ? 3.05 : 1.85, easedRange(p, .975, 1));
  return {
    state: HERO_VAN_SEQUENCE[index],
    blendToState: nextIndex === index ? undefined : HERO_VAN_SEQUENCE[nextIndex],
    stateBlend: nextIndex === index ? 0 : smooth(fraction),
    visible: p >= .13,
    targetX,
    groundY: mobile ? .85 : .88,
    canvasScale,
  };
}
