/**
 * Freshness contract for foreground courier GPS, which reports at most every
 * 25 seconds while the driver consents and keeps the page visible.
 * A stale point is historical evidence, not a live vehicle position.
 */
export const MAX_LIVE_TRACKING_AGE_MS = 3 * 60_000;
export const MAX_TRACKING_CLOCK_SKEW_MS = 30_000;

export function isFreshTrackingObservation(
  observedAt: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!observedAt || !Number.isFinite(nowMs)) return false;
  const observedMs = observedAt instanceof Date
    ? observedAt.getTime()
    : Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) return false;
  const ageMs = nowMs - observedMs;
  return ageMs >= -MAX_TRACKING_CLOCK_SKEW_MS && ageMs <= MAX_LIVE_TRACKING_AGE_MS;
}
