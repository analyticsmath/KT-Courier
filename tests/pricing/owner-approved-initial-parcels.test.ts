import { describe, expect, it } from "vitest";
import { OWNER_PARCEL_LIMITS_APPROVAL, planInitialParcelActivation } from "@/lib/commercial/owner-approved-initial-parcels";

const now = new Date("2026-10-13T13:00:00.000Z");
const row = (
  key: "SMALL" | "MEDIUM" | "LARGE",
  status = "DRAFT",
  values: [number, number, number, number] = [30, 20, 10, 5],
  versionNumber = 1,
) => ({
  stableKey: key, versionNumber, status,
  effectiveFrom: new Date("2026-10-12T00:00:00.000Z"), effectiveTo: null,
  lengthCm: values[0], widthCm: values[1], heightCm: values[2], maximumWeightKg: values[3],
});

describe("approved initial parcel profile activation", () => {
  it("requires a specific production approval flag", () => {
    expect(OWNER_PARCEL_LIMITS_APPROVAL).toBe("OWNER_APPROVED_2026_10_13_SMALL_MEDIUM_LARGE");
  });
  it("proposes all canonical sizes when absent", () => {
    expect(planInitialParcelActivation([], now).map((p) => [p.stableKey, p.expectedVersion]))
      .toEqual([["SMALL", 0], ["MEDIUM", 0], ["LARGE", 0]]);
  });
  it("preserves unchanged drafted dimensions, continuing their version history", () => {
    const p = planInitialParcelActivation([row("SMALL"), row("MEDIUM", "DRAFT", [50, 40, 30, 15], 2), row("LARGE", "DRAFT", [70, 50, 50, 30], 3)], now);
    expect(p.map((x) => [x.stableKey, x.expectedVersion, x.maximumWeightKg]))
      .toEqual([["SMALL", 1, 5], ["MEDIUM", 2, 15], ["LARGE", 3, 30]]);
  });
  it("is idempotent when exactly the owner's profile is already active", () => {
    expect(planInitialParcelActivation([
      row("SMALL", "ACTIVE"), row("MEDIUM", "ACTIVE", [50, 40, 30, 15]), row("LARGE", "ACTIVE", [70, 50, 50, 30]),
    ], now)).toEqual([]);
  });
  it("never overwrites differing draft values", () => {
    expect(() => planInitialParcelActivation([row("SMALL", "DRAFT", [33, 20, 10, 5])], now)).toThrow(/Requires explicit administrator review/);
  });
  it("never overwrites differing operator-approved active limits", () => {
    expect(() => planInitialParcelActivation([row("SMALL", "ACTIVE", [30, 20, 10, 7])], now)).toThrow(/No automatic overwrite/);
  });
  it("refuses conflicting concurrent effective versions", () => {
    expect(() => planInitialParcelActivation([row("SMALL", "ACTIVE"), row("SMALL", "ACTIVE", [30, 20, 10, 5], 2)], now))
      .toThrow(/Multiple effective active/);
  });
  it("does not override scheduled future active versions", () => {
    const future = { ...row("SMALL", "ACTIVE"), effectiveFrom: new Date("2026-10-15T00:00:00.000Z") };
    expect(() => planInitialParcelActivation([future], now)).toThrow(/Requires explicit administrator review/);
  });
});
