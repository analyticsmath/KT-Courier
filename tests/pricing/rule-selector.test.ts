import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/pricing/money";
import { selectPricingRule } from "@/lib/pricing/rule-selector";

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: "global", active: true, archivedAt: null, currency: "ZAR", deliveryType: "SAME_DAY", regionId: null, allowGlobalFallback: true,
    vehicleClass: null, maximumWeightKg: null, maxDistanceKm: null, effectiveFrom: null, effectiveTo: null, priority: 0, revision: 1,
    ...overrides,
  } as never;
}
const args = { deliveryType: "SAME_DAY" as never, regionId: "region-1", vehicleClass: null, weightKg: null, distanceKm: new Decimal("2"), now: new Date("2026-07-11") };
describe("pricing rule selector", () => {
  it("prefers exact region and filters inactive, archived and dated rules", () => {
    expect(selectPricingRule({ ...args, rules: [rule(), rule({ id: "region", regionId: "region-1" })] }).id).toBe("region");
    expect(() => selectPricingRule({ ...args, rules: [rule({ active: false }), rule({ id: "future", effectiveFrom: new Date("2027-01-01") })] })).toThrow("No eligible");
  });
  it("fails closed for equal precedence and enforces capacity-like rule limits", () => {
    expect(() => selectPricingRule({ ...args, rules: [rule({ id: "a" }), rule({ id: "b" })] })).toThrow("ambiguous");
    expect(() => selectPricingRule({ ...args, rules: [rule({ maxDistanceKm: new Decimal("1") })] })).toThrow("No eligible");
  });
});
