import { describe, expect, it } from "vitest";
import { PricingLineItemCode } from "@/types/db";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import { Decimal } from "@/lib/pricing/money";

const rule = {
  id: "rule", revision: 1, currency: "ZAR" as const, deliveryType: null, regionId: null,
  baseFee: new Decimal("20"), perKmRate: new Decimal("5"), includedDistanceKm: new Decimal("1"), distanceIncrementKm: new Decimal("0.5"),
  minimumCharge: null, flatSurcharge: null, vehicleClass: null, vehicleSurcharge: null, includedWeightKg: null, perAdditionalKgRate: null, maximumWeightKg: null, weightIncrementKg: null, dimensionalPricingEnabled: false, volumetricDivisor: null, maxDistanceKm: null,
};
function calculate(distanceMeters: number, tax = false) {
  return calculateDeliveryPrice({ input: { deliveryType: "SAME_DAY", distanceMeters, durationSeconds: null, vehicleClass: null, actualWeightKg: null, lengthCm: null, widthCm: null, heightCm: null }, rule, regionContext: { origin: null, destination: null }, taxConfig: { enabled: tax, rate: new Decimal("0.15"), source: "test" }, calculationVersion: "test" });
}
describe("pricing calculator", () => {
  it("uses included distance and Decimal increments", () => {
    expect(calculate(1000).total.toFixed(2)).toBe("20.00");
    expect(calculate(1101).billableDistanceKm.toString()).toBe("0.5");
    expect(calculate(1101).total.toFixed(2)).toBe("22.50");
  });
  it("reconciles VAT and preserves deterministic line items", () => {
    const result = calculate(1101, true);
    expect(result.taxAmount.toFixed(2)).toBe("3.38");
    expect(result.total.toFixed(2)).toBe("25.88");
    expect(result.lineItems.at(-1)?.code).toBe(PricingLineItemCode.VAT);
    expect(calculate(1101, true).total.toString()).toBe(result.total.toString());
  });
});
