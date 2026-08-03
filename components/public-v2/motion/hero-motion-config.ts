import type { HeroMotionTreatment } from "@/lib/public-assets/homepage-media";

export const heroMotionConfig = {
  desktop: {
    minWidth: 1120,
    minHeight: 680,
    scrollDistanceMin: 620,
    scrollDistanceMax: 1100,
    scrollDistanceViewportMultiplier: 0.96,
    scrub: 0.65,
    truckX: "42px",
    truckY: "-14px",
    truckScale: 1.026,
    truckRotate: "0.55deg",
    shadowX: "36px",
    shadowY: "-5px",
    shadowScale: 0.96,
    environmentY: "-3vh",
    environmentScale: 1.032,
    copyY: -10,
    copyOpacity: 0.9,
  },
  tablet: {
    minWidth: 768,
    scrub: 0.4,
    truckX: "18px",
    truckY: "-7px",
    truckScale: 1.012,
    shadowX: "15px",
    shadowY: "-3px",
    shadowScale: 0.98,
    environmentY: "-1.25vh",
    environmentScale: 1.012,
    copyY: -6,
    copyOpacity: 0.97,
  },
} as const;

export const heroMotionMediaQueries = {
  desktop: `(min-width: ${heroMotionConfig.desktop.minWidth}px) and (min-height: ${heroMotionConfig.desktop.minHeight}px) and (prefers-reduced-motion: no-preference)`,
  tablet: `(min-width: ${heroMotionConfig.tablet.minWidth}px) and (prefers-reduced-motion: no-preference) and ((max-width: ${heroMotionConfig.desktop.minWidth - 1}px) or (max-height: ${heroMotionConfig.desktop.minHeight - 1}px))`,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type HeroMotionViewport = {
  width: number;
  height: number;
  prefersReducedMotion: boolean;
  treatment: HeroMotionTreatment;
};

export function isDesktopHeroMotionEligible({
  width,
  height,
  prefersReducedMotion,
  treatment,
}: HeroMotionViewport): boolean {
  return (
    treatment === "BOUNDED_CAMERA" &&
    !prefersReducedMotion &&
    width >= heroMotionConfig.desktop.minWidth &&
    height >= heroMotionConfig.desktop.minHeight
  );
}

export function getDesktopHeroScrollDistance(viewportHeight: number): number {
  const preferredDistance = Math.round(
    viewportHeight * heroMotionConfig.desktop.scrollDistanceViewportMultiplier,
  );

  return Math.min(
    heroMotionConfig.desktop.scrollDistanceMax,
    Math.max(heroMotionConfig.desktop.scrollDistanceMin, preferredDistance),
  );
}
