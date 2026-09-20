export interface PhysicalRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Fraction of the actor's bounding box covered by a rendered physical layer. */
export function physicalCoverage(actorRect: PhysicalRect, occluderRect: PhysicalRect): number {
  const actorArea = Math.max(0, actorRect.width) * Math.max(0, actorRect.height);
  if (actorArea === 0) return 0;
  const overlapWidth = Math.max(0, Math.min(actorRect.left + actorRect.width, occluderRect.left + occluderRect.width) - Math.max(actorRect.left, occluderRect.left));
  const overlapHeight = Math.max(0, Math.min(actorRect.top + actorRect.height, occluderRect.top + occluderRect.height) - Math.max(actorRect.top, occluderRect.top));
  return Math.min(1, (overlapWidth * overlapHeight) / actorArea);
}

export function assertPhysicalCoverage(input: {
  actorRect: PhysicalRect;
  occluderRect: PhysicalRect;
  minimumCoverage?: number;
}): number {
  const measured = physicalCoverage(input.actorRect, input.occluderRect);
  const required = input.minimumCoverage ?? 0.85;
  if (measured < required) {
    throw new Error(`Physical occlusion covers ${(measured * 100).toFixed(1)}% of the actor; ${(required * 100).toFixed(1)}% is required.`);
  }
  return measured;
}
