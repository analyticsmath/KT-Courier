import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateMarketplaceCourierTariff } from "@/lib/marketplace-checkout/courier-tariff-calculation";
import type { DeliveryConfiguration } from "@/lib/client-platform/contracts";

const tariff = { baseFee: "89.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null };
const service: DeliveryConfiguration & { id: string; version: number } = { id: "economy-v2", version: 2, stableKey: "CLIENT_ECONOMY", displayName: "Economy", active: true, turnaround: "3–4 business days", provinces: ["Gauteng"], regionIds: [], tariffs: { SMALL: tariff, MEDIUM: { ...tariff, baseFee: "129.00" }, LARGE: { ...tariff, baseFee: "179.00" } }, expectedVersion: 1, reason: "Documented active tariff" };
const input = { service, parcel: { status: "CLASSIFIED" as const, sizeClass: "SMALL" as const, weightKg: 4.5, reason: "REVIEWED_SINGLE_PREPACKAGED_UNIT", packageVersion: 2, profileId: "small", profileVersion: 2 }, distanceMeters: 25500, durationSeconds: 1200, regionContext: { origin: null, destination: null }, tax: { enabled: false, rate: new Prisma.Decimal(0), source: "disabled" } };

describe("documented courier tariffs for marketplace parcels", () => {
  it.each([["SMALL", "89.00"], ["MEDIUM", "129.00"], ["LARGE", "179.00"]] as const)("uses the actual Economy %s fee across Gauteng", (sizeClass, total) => {
    const result = calculateMarketplaceCourierTariff({ ...input, parcel: { ...input.parcel, sizeClass } });
    expect(result.calculation.total.toFixed(2)).toBe(total);
    expect(result.rule.id).toBe("economy-v2"); expect(result.rule.revision).toBe(2);
  });
  it("applies an active store-specific R170 flat fee without altering public tariffs", () => {
    const negotiatedRate = {
      baseFee: new Prisma.Decimal("170.00"),
      perKmRate: new Prisma.Decimal("0.0000"),
      minimumCharge: null,
    };
    const tailored = calculateMarketplaceCourierTariff({ ...input, negotiatedRate });
    const regular = calculateMarketplaceCourierTariff(input);
    expect(tailored.calculation.subtotal.toFixed(2)).toBe("170.00");
    expect(tailored.calculation.total.toFixed(2)).toBe("170.00");
    expect(tailored.rule.baseFee.toFixed(2)).toBe("170.00");
    expect(regular.calculation.total.toFixed(2)).toBe("89.00");
  });
  it("retains applicable VAT and verified region risk for a negotiated store rate", () => {
    const negotiatedRate = {
      baseFee: new Prisma.Decimal("170.00"),
      perKmRate: new Prisma.Decimal(0),
      minimumCharge: null,
    };
    const result = calculateMarketplaceCourierTariff({
      ...input, negotiatedRate,
      regionContext: { origin: null, destination: { id: "high-risk", highRiskSurcharge: new Prisma.Decimal("20.00") } },
      tax: { enabled: true, rate: new Prisma.Decimal("0.15"), source: "configured" },
    });
    expect(result.calculation.subtotal.toFixed(2)).toBe("190.00");
    expect(result.calculation.total.toFixed(2)).toBe("218.50");
  });
  it("uses Express distance plus the fixed size component", () => {
    const result = calculateMarketplaceCourierTariff({ ...input, service: { ...service, stableKey: "CLIENT_EXPRESS", tariffs: { ...service.tariffs, SMALL: { ...tariff, baseFee: "5.50", perKmRate: "5.50" } } } });
    expect(result.calculation.total.toFixed(2)).toBe("145.75");
  });
  it("applies configured risk once and configured VAT to the full delivery subtotal", () => {
    const result = calculateMarketplaceCourierTariff({ ...input, regionContext: { origin: { id: "origin", highRiskSurcharge: new Prisma.Decimal(10) }, destination: { id: "destination", highRiskSurcharge: new Prisma.Decimal(20) } }, tax: { enabled: true, rate: new Prisma.Decimal("0.15"), source: "configured" } });
    expect(result.calculation.subtotal.toFixed(2)).toBe("109.00"); expect(result.calculation.total.toFixed(2)).toBe("125.35");
  });
  it.each([{ status: "UNKNOWN" }, { status: "UNSUPPORTED" }, { sizeClass: null }, { weightKg: undefined }, { weightKg: 0 }])("refuses unavailable package evidence %j", change => {
    expect(() => calculateMarketplaceCourierTariff({ ...input, parcel: { ...input.parcel, ...change } } as never)).toThrow("packed dimensions and weight must be verified");
  });
  it("respects the selected service's weight cap using measured weight", () => {
    expect(() => calculateMarketplaceCourierTariff({ ...input, service: { ...service, tariffs: { ...service.tariffs, SMALL: { ...tariff, maximumWeightKg: 4 } } } })).toThrow("Package weight is not supported");
  });
});
