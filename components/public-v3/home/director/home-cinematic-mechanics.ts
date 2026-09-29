import { clamp01, range, smooth } from "./home-beats";

export type Rect = { x: number; y: number; width: number; height: number };

/** One uniform scale preserves the selected product's image geometry. */
export function uniformProductPose(source: Rect, target: Rect, progress: number) {
  const p = smooth(clamp01(progress));
  const fit = Math.min(target.width / source.width, target.height / source.height);
  const scale = 1 + (fit - 1) * p;
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const centerX = sourceCenterX + (targetCenterX - sourceCenterX) * p;
  const centerY = sourceCenterY + (targetCenterY - sourceCenterY) * p;
  return { x: centerX - source.width * scale / 2, y: centerY - source.height * scale / 2, width: source.width, height: source.height, scale };
}

export function boxFlapPose(progress: number) {
  const p = clamp01(progress);
  return {
    left: 72 * (1 - smooth(range(p, 0, .42))),
    right: -72 * (1 - smooth(range(p, .08, .5))),
    rear: -77 * (1 - smooth(range(p, .40, .75))),
    front: 78 * (1 - smooth(range(p, .70, .96))),
    settle: smooth(range(p, .94, 1)),
  };
}

/** Two adjacent generated yaw plates share one anchor and one world scale. */
export function routeYawBlend(tangentDegrees: number, frameCount = 7) {
  const clamped = Math.max(0, Math.min((frameCount - 1) * 15, tangentDegrees));
  const lowerIndex = Math.min(frameCount - 1, Math.floor(clamped / 15));
  const upperIndex = Math.min(frameCount - 1, lowerIndex + 1);
  const blend = upperIndex === lowerIndex ? 0 : (clamped - lowerIndex * 15) / 15;
  const residual = upperIndex === lowerIndex ? 0 : Math.sin(blend * Math.PI) * .5;
  return { lowerIndex, upperIndex, blend, lowerOpacity: 1 - blend, upperOpacity: blend, residual };
}

/** The revealed plane ends at the visible rear edge of the right-moving truck. */
export function truckTrailingEdgeReveal(centerX: number, renderedWidth: number, canvasWidth: number, visibleBounds: Rect, viewportWidth: number) {
  const canvasLeft = centerX - renderedWidth / 2;
  const rearEdge = canvasLeft + renderedWidth * visibleBounds.x / canvasWidth;
  return { rearEdge, reveal: clamp01(rearEdge / viewportWidth) };
}

export function rollingPreloadIds(ids: readonly string[], index: number, forward = true) {
  const start = Math.max(0, index - (forward ? 1 : 2));
  const end = Math.min(ids.length, index + (forward ? 3 : 2));
  return ids.slice(start, end);
}

export function selectedProductForTakeover(selectedId: string | undefined, frozenId: string | undefined, progress: number, takeoverStart: number) {
  return progress >= takeoverStart ? frozenId ?? selectedId : undefined;
}

export function effectiveScrollPixels(sectionHeight: number, stickyHeight: number) {
  return Math.max(1, sectionHeight - stickyHeight);
}
