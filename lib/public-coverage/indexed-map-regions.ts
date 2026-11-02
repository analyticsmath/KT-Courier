/**
 * Map pins only exist for regions with real map centres, but each pin must
 * retain its source-index identity so selection stays aligned with the
 * complete authoritative coverage list (including province-wide regions).
 */
export function indexPublicCoverageMapRegions<T extends { centerLat?: number | null; centerLng?: number | null }>(
  regions: readonly T[],
): Array<{ region: T; index: number }> {
  return regions.flatMap((region, index) =>
    typeof region.centerLat === "number" && Number.isFinite(region.centerLat) &&
    typeof region.centerLng === "number" && Number.isFinite(region.centerLng) &&
    region.centerLat >= -90 && region.centerLat <= 90 && region.centerLng >= -180 && region.centerLng <= 180
      ? [{ region, index }]
      : [],
  );
}
