/**
 * KT Courier Public Experience — Motion Tokens and Cinematic Constants
 */

export const KT_EASE = {
  cinematic: "power3.out",
  cinematicIn: "power3.in",
  cinematicInOut: "power3.inOut",
  smooth: "power2.out",
  expoOut: "expo.out",
  linear: "none",
} as const;

export const KT_TIMING = {
  headerTone: 0.22,
  stateSwapMin: 0.18,
  chapterTransition: 0.8,
  panelAccordion: 0.65,
  actorEntrance: 0.85,
  actorExit: 0.75,
} as const;

export const KT_CHAPTER_IDS = [
  "hero",
  "commerce",
  "collection",
  "route",
  "freight",
  "arrival",
  "finale",
] as const;

export type KtChapterId = (typeof KT_CHAPTER_IDS)[number];
