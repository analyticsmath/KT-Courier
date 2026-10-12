import { describe, expect, it } from "vitest";
import { MarketplaceDeliveryMatrixSchema, selectMarketplaceDeliveryPolicy, type DeliveryPolicyVersion } from "@/lib/marketplace-checkout/delivery-policy";

const baseRule = { key: "GAUTENG_SMALL", sizeClass: "SMALL" as const, minDistanceKm: 0, maxDistanceKm: 30, province: "Gauteng" as const, regionId: null, storeId: null, fee: "45.00", highRiskSurcharge: "10.00", minimumFee: "40.00", maximumFee: "60.00" };
const version: DeliveryPolicyVersion = { version: 1, status: "ACTIVE", createdByUserId: "author", approvedByUserId: "reviewer", approvedAt: "2026-10-01T00:00:00Z", effectiveFrom: "2026-10-01T00:00:00Z", effectiveTo: null, rules: [baseRule] };
const context = { sizeClass: "SMALL" as const, distanceKm: 10, province: "Gauteng", regionId: "region-a", storeId: "store-a", highRisk: false, now: new Date("2026-10-07T00:00:00Z") };
describe("explicit marketplace delivery policies", () => {
  it("selects exact bands without interpolating a courier rate", () => expect(selectMarketplaceDeliveryPolicy([version], context).fee).toBe("45.00"));
  it("honors store over region over province precedence", () => {
    const rules = [baseRule, { ...baseRule, key: "REGION", regionId: "region-a", fee: "46.00" }, { ...baseRule, key: "STORE", storeId: "store-a", fee: "47.00" }];
    expect(selectMarketplaceDeliveryPolicy([{ ...version, rules }], context).ruleKey).toBe("STORE");
    expect(selectMarketplaceDeliveryPolicy([{ ...version, rules: rules.slice(0, 2) }], context).ruleKey).toBe("REGION");
  });
  it("applies high-risk surcharge and explicit fee caps", () => {
    expect(selectMarketplaceDeliveryPolicy([version], { ...context, highRisk: true }).fee).toBe("55.00");
    expect(selectMarketplaceDeliveryPolicy([{ ...version, rules: [{ ...baseRule, highRiskSurcharge: "25.00" }] }], { ...context, highRisk: true }).fee).toBe("60.00");
  });
  it("fails closed for missing, draft, expired, self-approved, overlapping, or unmatched policy", () => {
    for (const versions of [[], [{ ...version, status: "DRAFT" as const }], [{ ...version, approvedByUserId: "author" }], [{ ...version, effectiveTo: "2026-10-02T00:00:00Z" }], [{ ...version, rules: [baseRule, { ...baseRule, key: "OVERLAP" }] }]]) expect(() => selectMarketplaceDeliveryPolicy(versions, context)).toThrow();
    expect(() => selectMarketplaceDeliveryPolicy([version], { ...context, distanceKm: 30 })).toThrow();
    expect(() => selectMarketplaceDeliveryPolicy([version], { ...context, sizeClass: null })).toThrow();
  });
  it("uses current effective approved version and preserves old matrix values", () => {
    const updated = { ...version, version: 2, rules: [{ ...baseRule, fee: "50.00" }] };
    expect(selectMarketplaceDeliveryPolicy([version, updated], context).policyVersion).toBe(2);
    expect(version.rules[0].fee).toBe("45.00");
    expect(selectMarketplaceDeliveryPolicy([version, { ...updated, status: "DRAFT" }], context).policyVersion).toBe(1);
  });
  it("rejects contradictory authoring input", () => {
    expect(MarketplaceDeliveryMatrixSchema.safeParse({ effectiveFrom: version.effectiveFrom, effectiveTo: null, rules: [{ ...baseRule, maxDistanceKm: 0 }] }).success).toBe(false);
  });
});
