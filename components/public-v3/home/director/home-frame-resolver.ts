import { HERO_VAN_SEQUENCE } from "./hero-van-sequence.generated";
import { clamp01, HOME_BEATS, range, smooth } from "./home-beats";

export const ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG = 180;

export function routeTruckRotationForTangent(tangentDeg: number): number {
  return tangentDeg + ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG;
}

export type HeroVanPhase = "poster" | "entry" | "turn" | "front-settle" | "approach" | "hold" | "release";
export type HeroVanFrame = {
  state: string;
  blendToState?: string;
  stateBlend: number;
  visible: boolean;
  opacity: number;
  phase: HeroVanPhase;
  targetCenterX: number;
  visibleCenterY: number;
  visibleHeightVh: number;
  groundY: number;
  anchorMode: "ground" | "transition" | "center";
  anchorBlend: number;
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const easedRange = (p: number, start: number, end: number) => smooth(range(p, start, end));

/** One progress-derived pose for forward, reverse, and arbitrary scroll seeks. */
export function resolveHeroVanFrame(progress: number, viewportMode: "mobile" | "desktop"): HeroVanFrame {
  const p = clamp01(progress);
  const mobile = viewportMode === "mobile";
  const beats = HOME_BEATS.hero;
  const phase: HeroVanPhase = p < beats.entryReveal[0] ? "poster"
    : p < beats.turnTravel[0] ? "entry"
      : p < beats.frontSettle[0] ? "turn"
        : p < beats.frontApproach[0] ? "front-settle"
          : p < beats.frontHold[0] ? "approach"
            : p < beats.release[0] ? "hold" : "release";
  const turnPosition = easedRange(p, ...beats.turnTravel) * (HERO_VAN_SEQUENCE.length - 1);
  const index = Math.min(HERO_VAN_SEQUENCE.length - 1, Math.floor(turnPosition));
  const nextIndex = Math.min(HERO_VAN_SEQUENCE.length - 1, index + 1);
  const fraction = turnPosition - index;
  const blendToState = phase === "turn" && nextIndex !== index ? HERO_VAN_SEQUENCE[nextIndex] : undefined;
  const entryT = easedRange(p, ...beats.entryReveal);
  const turnT = easedRange(p, ...beats.turnTravel);
  const settleT = easedRange(p, ...beats.frontSettle);
  const approachT = easedRange(p, ...beats.frontApproach);
  const releaseT = easedRange(p, ...beats.release);
  const targetCenterX = p < beats.turnTravel[0]
    ? lerp(mobile ? -.35 : -.18, mobile ? .18 : .24, entryT)
    : lerp(mobile ? .18 : .24, .5, turnT);

  let visibleHeightVh = mobile ? 30 : 31;
  if (phase === "entry") visibleHeightVh = lerp(mobile ? 30 : 31, 38, entryT);
  else if (phase === "turn") visibleHeightVh = lerp(38, mobile ? 50 : 54, turnT);
  else if (phase === "front-settle") visibleHeightVh = lerp(mobile ? 50 : 54, mobile ? 54 : 56, settleT);
  else if (phase === "approach") visibleHeightVh = lerp(mobile ? 54 : 56, mobile ? 70 : 72, approachT);
  else if (phase === "hold") visibleHeightVh = mobile ? 70 : 72;
  else if (phase === "release") visibleHeightVh = lerp(mobile ? 70 : 72, mobile ? 58 : 60, releaseT);

  const anchorMode = phase === "front-settle" ? "transition" : phase === "poster" || phase === "entry" || phase === "turn" ? "ground" : "center";
  const anchorBlend = anchorMode === "ground" ? 0 : anchorMode === "center" ? 1 : settleT;
  const visibleCenterY = phase === "approach" ? lerp(.55, .52, approachT)
    : phase === "release" ? lerp(.52, .57, releaseT)
      : phase === "hold" ? .52 : .55;
  const opacity = phase === "poster" ? 0
    : phase === "entry" ? easedRange(p, .13, .17)
      : phase === "release" ? 1 - easedRange(p, .96, 1) : 1;
  return {
    state: HERO_VAN_SEQUENCE[index],
    blendToState,
    stateBlend: blendToState ? easedRange(fraction, .78, 1) : 0,
    visible: opacity > 0,
    opacity,
    phase,
    targetCenterX,
    visibleCenterY,
    visibleHeightVh,
    groundY: mobile ? .85 : .88,
    anchorMode,
    anchorBlend,
  };
}
