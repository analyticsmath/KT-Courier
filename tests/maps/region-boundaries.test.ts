import { describe, expect, it } from "vitest";
import { assertRegionActivation, regionBoundaryIssues } from "@/lib/maps/region-boundaries";

const valid = { active: true, pricingEnabled: true, province: "Gauteng", centerLat: -26.2, centerLng: 28.0, coverageRadiusKm: 30, maxDistanceKm: 60 };
describe("operational region activation", () => {
  it("requires each centre, radius, maximum distance and valid province", () => {
    for (const field of ["centerLat", "centerLng", "coverageRadiusKm", "maxDistanceKm", "province"] as const) {
      expect(regionBoundaryIssues({ ...valid, [field]: null })).toContain(field);
      expect(() => assertRegionActivation({ ...valid, [field]: null })).toThrow();
    }
  });
  it("rejects malformed numeric boundaries and wrong provinces", () => {
    for (const patch of [{ centerLat: 91 }, { centerLng: -181 }, { centerLat: NaN }, { coverageRadiusKm: 0 }, { coverageRadiusKm: -1 }, { maxDistanceKm: 0 }, { maxDistanceKm: 501 }, { province: "Unknown" }]) {
      expect(() => assertRegionActivation({ ...valid, ...patch })).toThrow();
    }
  });
  it("permits inactive drafts and disabled pricing without inventing boundaries", () => {
    expect(() => assertRegionActivation({ active: false, pricingEnabled: true })).not.toThrow();
    expect(() => assertRegionActivation({ active: true, pricingEnabled: false })).not.toThrow();
    expect(() => assertRegionActivation(valid)).not.toThrow();
  });
});
