/** Pure ring geometry shared by the Shop spinner and scroll-authored homepage. */
export function categoryOrbitAngle(index: number, count: number, turns = 0): number {
  return (index / Math.max(1, count) + turns) * 360;
}
