import { HERO_VAN_SEQUENCE } from "./hero-van-sequence.generated";
import { clamp01, HOME_BEATS, HOME_MOBILE_HERO_BEATS, range, smooth } from "./home-beats";

export const ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG = 180;

export function routeTruckRotationForTangent(tangentDeg: number): number {
  return tangentDeg + ROUTE_TRUCK_ASSET_HEADING_OFFSET_DEG;
}

export type HeroVanPhase = "poster" | "entry" | "turn" | "front-settle" | "approach" | "deep-approach" | "camera-pass" | "final-clear" | "hold" | "release";
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

/** Equal-power weights keep the composite vehicle solid during a two-frame blend. */
export function heroVanBlendWeights(blend: number): { current: number; next: number } {
  const angle = clamp01(blend) * Math.PI * .5;
  return { current: Math.cos(angle), next: Math.sin(angle) };
}

/** One progress-derived pose for forward, reverse, and arbitrary scroll seeks. */
export function resolveHeroVanFrame(progress: number, viewportMode: "mobile" | "desktop"): HeroVanFrame {
  const p = clamp01(progress);
  const mobile = viewportMode === "mobile";
  const beats = HOME_BEATS.hero;
  const mobileBeats = HOME_MOBILE_HERO_BEATS;
  const phase: HeroVanPhase = p < beats.entryReveal[0] ? "poster"
    : p < beats.turnTravel[0] ? "entry"
      : p < beats.frontSettle[0] ? "turn"
        : mobile
          ? p < mobileBeats.frontApproach[0] ? "front-settle"
            : p < mobileBeats.frontHold[0] ? "approach"
              : p < mobileBeats.release[0] ? "hold" : "release"
          : p < beats.fullBodyApproach[0] ? "front-settle"
            : p < beats.deepApproach[0] ? "approach"
              : p < beats.cameraPass[0] ? "deep-approach"
                : p < beats.finalClear[0] ? "camera-pass" : "final-clear";
  const turnPosition = easedRange(p, ...beats.turnTravel) * (HERO_VAN_SEQUENCE.length - 1);
  const index = Math.min(HERO_VAN_SEQUENCE.length - 1, Math.floor(turnPosition));
  const nextIndex = Math.min(HERO_VAN_SEQUENCE.length - 1, index + 1);
  const fraction = turnPosition - index;
  const blendToState = phase === "turn" && nextIndex !== index ? HERO_VAN_SEQUENCE[nextIndex] : undefined;
  const entryT = easedRange(p, ...beats.entryReveal);
  const turnT = easedRange(p, ...beats.turnTravel);
  const settleBeats = mobile ? mobileBeats.frontSettle : beats.frontSettle;
  const settleT = easedRange(p, settleBeats[0], settleBeats[1]);
  const mobileApproachT = easedRange(p, ...mobileBeats.frontApproach);
  const fullBodyT = easedRange(p, ...beats.fullBodyApproach);
  const deepT = easedRange(p, ...beats.deepApproach);
  const passT = easedRange(p, ...beats.cameraPass);
  const targetCenterX = p < beats.turnTravel[0]
    ? lerp(mobile ? -.35 : -.18, mobile ? .18 : .24, entryT)
    : lerp(mobile ? .18 : .24, .5, turnT);

  let visibleHeightVh = mobile ? 30 : 31;
  if (phase === "entry") visibleHeightVh = lerp(mobile ? 30 : 31, 38, entryT);
  else if (phase === "turn") visibleHeightVh = lerp(38, mobile ? 54 : 56, turnT);
  else if (phase === "front-settle") visibleHeightVh = lerp(mobile ? 54 : 56, mobile ? 60 : 62, settleT);
  else if (mobile) {
    if (phase === "approach") visibleHeightVh = lerp(60, 76, mobileApproachT);
    else if (phase === "hold") visibleHeightVh = 76;
    else if (phase === "release") visibleHeightVh = 76;
  } else {
    if (phase === "approach") visibleHeightVh = lerp(62, 88, fullBodyT);
    else if (phase === "deep-approach") visibleHeightVh = lerp(88, 108, deepT);
    else if (phase === "camera-pass") visibleHeightVh = lerp(108, 132, passT);
    else if (phase === "final-clear") visibleHeightVh = 132;
  }

  const anchorMode = phase === "front-settle" ? "transition" : phase === "poster" || phase === "entry" || phase === "turn" ? "ground" : "center";
  const anchorBlend = anchorMode === "ground" ? 0 : anchorMode === "center" ? 1 : settleT;
  const visibleCenterY = mobile
    ? .57
    : phase === "approach" ? lerp(.58, .585, fullBodyT)
      : phase === "deep-approach" ? lerp(.585, .59, deepT)
        : phase === "camera-pass" ? lerp(.59, .62, passT)
          : phase === "final-clear" ? .62 : .58;
  const opacity = phase === "poster" ? 0
    : phase === "entry" ? easedRange(p, .13, .17)
      : 1;
  return {
    state: HERO_VAN_SEQUENCE[index],
    blendToState,
    stateBlend: blendToState ? easedRange(fraction, .68, 1) : 0,
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
