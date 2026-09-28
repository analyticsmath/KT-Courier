export function wrappedCategoryDelta(index: number, active: number, count: number): number {
  if (count <= 1) return 0;
  let delta = index - active;
  const half = Math.floor(count / 2);
  if (delta > half) delta -= count;
  if (delta < -half) delta += count;
  return delta;
}

export function categoryFanPose(delta: number, reducedMotion = false) {
  const distance = Math.abs(delta);
  return {
    x: `calc(${delta} * var(--fan-step))`,
    rotateY: reducedMotion ? 0 : delta === 0 ? 0 : -Math.sign(delta) * (distance === 1 ? 17 : 30),
    z: reducedMotion ? 0 : distance === 0 ? 100 : distance === 1 ? 0 : -140,
    scale: distance === 0 ? 1 : distance === 1 ? 0.86 : 0.68,
    opacity: distance === 0 ? 1 : distance === 1 ? 0.88 : 0.58,
  };
}
