import { PROVINCES } from "@/lib/client-platform/contracts";

export type RegionBoundary = {
  province?: string | null;
  centerLat?: unknown;
  centerLng?: unknown;
  coverageRadiusKm?: unknown;
  maxDistanceKm?: unknown;
};

export function regionBoundaryIssues(region: RegionBoundary): string[] {
  const issues: string[] = [];
  if (!PROVINCES.some((p) => p === region.province)) issues.push("province");
  for (const [key, min, max] of [
    ["centerLat", -90, 90], ["centerLng", -180, 180],
    ["coverageRadiusKm", 0, 500], ["maxDistanceKm", 0, 500],
  ] as const) {
    const raw = region[key];
    const value = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(value) || value < min || value > max || (min === 0 && value === 0)) issues.push(key);
  }
  return issues;
}

export class RegionConfigurationError extends Error {
  constructor(readonly status: 409 | 422, message: string) { super(message); }
}

export function assertRegionActivation(region: RegionBoundary & { active?: boolean; pricingEnabled?: boolean }) {
  if (!region.active || region.pricingEnabled === false) return;
  const issues = regionBoundaryIssues(region);
  if (issues.length) throw new RegionConfigurationError(422, `Operational boundaries required: ${issues.join(", ")}. Save inactive or disable pricing until operations supplies them.`);
}
