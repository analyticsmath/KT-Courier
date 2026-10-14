import { regionBoundaryIssues, type RegionBoundary } from "@/lib/maps/region-boundaries";

/** Input is the same active pricing region set used by the runtime resolver. */
export function evaluateCoverageEvidence<T extends RegionBoundary & { id: string }>(regions: readonly T[]) {
  const usable = regions.filter(region => regionBoundaryIssues(region).length === 0);
  const incomplete = regions.filter(region => regionBoundaryIssues(region).length > 0);
  const provinces = [...new Set(regions.map(region => region.province ?? "UNSPECIFIED"))];
  const unavailableProvinces = provinces.filter(province => !usable.some(region => region.province === province));
  return { ready: usable.length > 0 && unavailableProvinces.length === 0, usable, incomplete, unavailableProvinces };
}
