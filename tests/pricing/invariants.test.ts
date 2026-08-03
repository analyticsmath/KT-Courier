import { describe, expect, it } from "vitest";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import { Decimal } from "@/lib/pricing/money";

const baseRule = {
  id: "r", revision: 1, currency: "ZAR" as const, deliveryType: null, regionId: null, baseFee: new Decimal("5"), perKmRate: new Decimal("2"), includedDistanceKm: new Decimal("0"), distanceIncrementKm: new Decimal("0.1"), minimumCharge: new Decimal("10"), flatSurcharge: null, vehicleClass: null, vehicleSurcharge: null, includedWeightKg: null, perAdditionalKgRate: null, maximumWeightKg: null, weightIncrementKg: null, dimensionalPricingEnabled: false, volumetricDivisor: null, maxDistanceKm: null,
};
function price(distanceMeters: number) { return calculateDeliveryPrice({ input: { deliveryType: "SAME_DAY", distanceMeters, durationSeconds: 1, vehicleClass: null, actualWeightKg: null, lengthCm: null, widthCm: null, heightCm: null }, rule: baseRule, regionContext: { origin: null, destination: null }, taxConfig: { enabled: true, rate: new Decimal("0.15"), source: "test" }, calculationVersion: "test" }); }
describe("pricing invariants", () => {
  it("reconciles line items and never reduces price as distance grows", () => {
    const a = price(100); const b = price(1000);
    const subtotal = a.lineItems.filter((item) => item.code !== "VAT").reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
    expect(subtotal.equals(a.subtotal)).toBe(true);
    expect(a.subtotal.plus(a.taxAmount).equals(a.total)).toBe(true);
    expect(b.total.greaterThanOrEqualTo(a.total)).toBe(true);
    expect(a.total.greaterThanOrEqualTo(0)).toBe(true);
  });
});
