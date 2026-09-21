import { clamp01 } from "./home-beats";

/**
 * Interpolates actual measured card centres. This deliberately has no assumed
 * card step: gaps, responsive widths, and future rail changes remain correct.
 */
export function marketplaceTrackX(centers: readonly number[], positionIndex: number, viewportCenter: number): number {
  if (!centers.length) return 0;
  const bounded = Math.min(centers.length - 1, Math.max(0, positionIndex));
  const lower = Math.floor(bounded);
  const upper = Math.min(centers.length - 1, Math.ceil(bounded));
  const fraction = bounded - lower;
  const center = centers[lower]! + (centers[upper]! - centers[lower]!) * fraction;
  return viewportCenter - center;
}

export function marketplacePositionForProgress(progress: number, count: number): number {
  if (count <= 1) return 0;
  return clamp01(progress) * (count - 1);
}

/** Places an actor using its visible pixels, rather than its transparent canvas. */
export function actorTargetForOffscreenEdge({
  definition,
  renderedWidth,
  viewportWidth,
  edge,
  marginPx = 0,
}: {
  definition: { visibleBounds: { x: number; width: number }; groundContact: { x: number } };
  renderedWidth: number;
  viewportWidth: number;
  edge: "left" | "right";
  marginPx?: number;
}): number {
  const visibleLeft = definition.visibleBounds.x * renderedWidth;
  const visibleRight = (definition.visibleBounds.x + definition.visibleBounds.width) * renderedWidth;
  const contactOffset = definition.groundContact.x * renderedWidth;
  const targetPx = edge === "left"
    ? -marginPx - visibleRight + contactOffset
    : viewportWidth + marginPx - visibleLeft + contactOffset;
  return targetPx / viewportWidth;
}
