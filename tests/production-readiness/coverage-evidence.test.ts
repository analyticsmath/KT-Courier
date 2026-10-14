import { describe, expect, it } from "vitest";
import { evaluateCoverageEvidence } from "@/lib/production-readiness/coverage-evidence";

const province = { id: "gauteng", coverageMode: "PROVINCE", province: "Gauteng", maxDistanceKm: null };
const incomplete = { id: "old-city", coverageMode: "RADIUS", province: "Gauteng", centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null };
describe("operational coverage evidence", () => {
  it("recognizes province coverage without fabricated circle coordinates", () => expect(evaluateCoverageEvidence([province])).toMatchObject({ ready: true, usable: [province], incomplete: [] }));
  it("reports incomplete overlapping records without declaring a usable province unavailable", () => expect(evaluateCoverageEvidence([province, incomplete])).toMatchObject({ ready: true, usable: [province], incomplete: [incomplete], unavailableProvinces: [] }));
  it("does not use Gauteng coverage to certify an incomplete different province", () => expect(evaluateCoverageEvidence([province, { ...incomplete, province: "Western Cape" }])).toMatchObject({ ready: false, unavailableProvinces: ["Western Cape"] }));
  it("rejects absent or incomplete-only operational coverage", () => {
    expect(evaluateCoverageEvidence([]).ready).toBe(false);
    expect(evaluateCoverageEvidence([incomplete])).toMatchObject({ ready: false, unavailableProvinces: ["Gauteng"] });
  });
  it("retains configured road limits and rejects invalid province mode limits", () => expect(evaluateCoverageEvidence([{ ...province, maxDistanceKm: -1 }]).ready).toBe(false));
});
