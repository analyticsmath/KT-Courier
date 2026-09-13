import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import { PricingLineItemCode } from "@/types/db";
import type {
  NormalizedPricingInput,
  PricingRegionContext,
  PricingRuleSnapshot,
  PricingTaxConfig,
} from "@/lib/pricing/types";
import type { AppliedCommercialSurcharge } from "@/lib/commercial/configuration.service";

describe("Phase 1 Acceptance: Commercial Delivery Surcharge Calculations", () => {
  const baseRule: PricingRuleSnapshot = {
    id: "rule-standard-1",
    revision: 1,
    currency: "ZAR",
    deliveryType: "SAME_DAY",
    regionId: "reg-jhb",
    baseFee: new Prisma.Decimal("40.00"),
    perKmRate: new Prisma.Decimal("5.00"),
    includedDistanceKm: new Prisma.Decimal("5.00"),
    distanceIncrementKm: new Prisma.Decimal("1.00"),
    minimumCharge: new Prisma.Decimal("40.00"),
    flatSurcharge: null,
    vehicleClass: null,
    vehicleSurcharge: null,
    includedWeightKg: new Prisma.Decimal("5.00"),
    perAdditionalKgRate: null,
    maximumWeightKg: null,
    weightIncrementKg: null,
    dimensionalPricingEnabled: false,
    volumetricDivisor: null,
    maxDistanceKm: new Prisma.Decimal("100.00"),
  };

  const baseInput: NormalizedPricingInput = {
    deliveryType: "SAME_DAY",
    distanceMeters: 5000, // 5km, exact included distance
    durationSeconds: 900,
    vehicleClass: null,
    actualWeightKg: new Prisma.Decimal("2.00"),
    lengthCm: null,
    widthCm: null,
    heightCm: null,
  };

  const regionContext: PricingRegionContext = {
    origin: null,
    destination: null,
  };

  const taxConfig: PricingTaxConfig = {
    enabled: true,
    rate: new Prisma.Decimal("0.15"), // 15% VAT
    source: "STATUTORY_ZAR_VAT",
  };

  it("calculates fixed commercial surcharge and attaches customer message and metadata", () => {
    const fixedSurcharge: AppliedCommercialSurcharge = {
      id: "sur-peak-1",
      stableKey: "peak-hours-johannesburg",
      versionNumber: 2,
      calculationType: "FIXED",
      value: new Prisma.Decimal("15.00"),
      reason: "Peak delivery hours",
      customerMessage: "Peak hours demand fee: R15.00",
      priority: 10,
    };

    const result = calculateDeliveryPrice({
      input: baseInput,
      rule: baseRule,
      regionContext,
      taxConfig,
      calculationVersion: "calc-v1",
      configuredSurcharges: [fixedSurcharge],
    });

    // Base: 40.00, Surcharge: 15.00 -> Subtotal: 55.00, VAT: 8.25, Total: 63.25
    expect(result.subtotal.toString()).toBe("55");
    expect(result.taxAmount.toString()).toBe("8.25");
    expect(result.total.toString()).toBe("63.25");

    const surchargeLine = result.lineItems.find((item) => item.code === PricingLineItemCode.RULE_SURCHARGE);
    expect(surchargeLine).toBeDefined();
    expect(surchargeLine?.label).toBe("Peak hours demand fee: R15.00");
    expect(surchargeLine?.amount.toString()).toBe("15");
    expect(surchargeLine?.metadata).toMatchObject({
      commercialSurchargeId: "sur-peak-1",
      stableKey: "peak-hours-johannesburg",
      versionNumber: "2",
      calculationType: "FIXED",
    });
  });

  it("calculates percentage commercial surcharge relative to configured subtotal", () => {
    // 10% commercial fuel surcharge
    const percentageSurcharge: AppliedCommercialSurcharge = {
      id: "sur-fuel-1",
      stableKey: "fuel-surcharge-2026",
      versionNumber: 1,
      calculationType: "PERCENTAGE",
      value: new Prisma.Decimal("0.10"), // 10%
      reason: "Fuel cost adjustment",
      customerMessage: "Temporary fuel surcharge (+10%)",
      priority: 20,
    };

    const result = calculateDeliveryPrice({
      input: baseInput,
      rule: baseRule,
      regionContext,
      taxConfig,
      calculationVersion: "calc-v1",
      configuredSurcharges: [percentageSurcharge],
    });

    // Base: 40.00, 10% of 40.00 is 4.00 -> Subtotal: 44.00, VAT: 6.60, Total: 50.60
    expect(result.subtotal.toString()).toBe("44");
    expect(result.taxAmount.toString()).toBe("6.6");
    expect(result.total.toString()).toBe("50.6");

    const surchargeLine = result.lineItems.find((item) => item.code === PricingLineItemCode.RULE_SURCHARGE);
    expect(surchargeLine).toBeDefined();
    expect(surchargeLine?.label).toBe("Temporary fuel surcharge (+10%)");
    expect(surchargeLine?.amount.toString()).toBe("4");
    expect(surchargeLine?.metadata).toMatchObject({
      calculationType: "PERCENTAGE",
      stableKey: "fuel-surcharge-2026",
    });
  });

  it("falls back to surcharge reason when customerMessage is not provided", () => {
    const surchargeWithoutMessage: AppliedCommercialSurcharge = {
      id: "sur-weather-1",
      stableKey: "bad-weather-capetown",
      versionNumber: 1,
      calculationType: "FIXED",
      value: new Prisma.Decimal("20.00"),
      reason: "Inclement weather operational fee",
      customerMessage: null,
      priority: 5,
    };

    const result = calculateDeliveryPrice({
      input: baseInput,
      rule: baseRule,
      regionContext,
      taxConfig,
      calculationVersion: "calc-v1",
      configuredSurcharges: [surchargeWithoutMessage],
    });

    const surchargeLine = result.lineItems.find((item) => item.code === PricingLineItemCode.RULE_SURCHARGE);
    expect(surchargeLine?.label).toBe("Inclement weather operational fee");
  });
});
