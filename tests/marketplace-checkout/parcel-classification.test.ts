import { describe, expect, it } from "vitest";
import { classifyTrustedMarketplaceParcel, TrustedPackageSchema, type TrustedPackageVersion, type ParcelLimits, type ParcelSourceLine } from "@/lib/marketplace-checkout/parcel-classification";
import { selectMarketplaceDeliveryPolicy, type DeliveryPolicyVersion } from "@/lib/marketplace-checkout/delivery-policy";

const now = new Date("2026-10-08T12:00:00Z");
const profiles: ParcelLimits[] = [
  { id: "small-1", stableKey: "SMALL", versionNumber: 1, lengthCm: 20, widthCm: 15, heightCm: 10, maximumWeightKg: 5 },
  { id: "medium-2", stableKey: "MEDIUM", versionNumber: 2, lengthCm: 40, widthCm: 30, heightCm: 20, maximumWeightKg: 10 },
  { id: "large-3", stableKey: "LARGE", versionNumber: 3, lengthCm: 80, widthCm: 60, heightCm: 40, maximumWeightKg: 20 },
];
const entry: TrustedPackageVersion["packages"][number] = { storeId: "store", offerReference: "offer", variantReference: "variant", publicationVersion: "pub1", modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT" as const, lengthCm: 20, widthCm: 15, heightCm: 10, weightKg: 5, authorityReference: "disposable:measurement" };
const version: TrustedPackageVersion = { version: 1, status: "ACTIVE", createdByUserId: "author", approvedByUserId: "reviewer", approvedAt: now.toISOString(), effectiveFrom: "2026-10-01T00:00:00Z", effectiveTo: null, packages: [entry] };
const line: ParcelSourceLine = { offerReference: "offer", variantReference: "variant", publicationVersion: "pub1", quantity: 1, modifiers: [] };
function classify(pack = entry, source = line, versions: TrustedPackageVersion[] = [{ ...version, packages: [pack] }], limits = profiles) { return classifyTrustedMarketplaceParcel({ storeId: "store", lines: [source], versions, profiles: limits, now }); }

describe("server-authoritative marketplace parcel measurements", () => {
  it("classifies the exact small limit including rotated axes and freezes profile authority", () => {
    expect(classify({ ...entry, lengthCm: 10, widthCm: 20, heightCm: 15 })).toEqual({ status: "CLASSIFIED", sizeClass: "SMALL", reason: "REVIEWED_SINGLE_PREPACKAGED_UNIT", packageVersion: 1, profileId: "small-1", profileVersion: 1 });
  });
  it.each([{ weightKg: 5.0001 }, { lengthCm: 20.0001 }, { heightCm: 10.0001 }])("moves a package just beyond a small boundary to medium (%j)", (change) => { expect(classify({ ...entry, ...change }).sizeClass).toBe("MEDIUM"); });
  it("accepts large's exact boundary and refuses overweight or overflow rather than selecting ANY", () => {
    expect(classify({ ...entry, lengthCm: 80, widthCm: 60, heightCm: 40, weightKg: 20 }).sizeClass).toBe("LARGE");
    for (const change of [{ weightKg: 20.0001 }, { lengthCm: 80.0001 }]) expect(classify({ ...entry, ...change })).toMatchObject({ status: "UNSUPPORTED", sizeClass: null });
  });
  it.each([0, -1, NaN, Infinity, 1000.0001, 0.00001])("rejects invalid measurement precision or bounds (%s)", (lengthCm) => { expect(TrustedPackageSchema.safeParse({ ...entry, lengthCm }).success).toBe(false); });
  it("permits four fractional decimals without binary rounding false rejection", () => { expect(TrustedPackageSchema.safeParse({ ...entry, lengthCm: 0.0003 }).success).toBe(true); });
  it.each(["DRAFT", "APPROVED", "RETIRED"] as const)("cannot classify a %s package", (status) => { expect(classify(entry, line, [{ ...version, status }]).status).toBe("UNKNOWN"); });
  it("denies self-approval, expired/future policy and duplicate exact evidence", () => {
    for (const change of [{ approvedByUserId: "author" }, { approvedAt: null }, { effectiveTo: now.toISOString() }, { effectiveFrom: "2026-10-09T00:00:00Z" }, { packages: [entry, entry] }]) expect(classify(entry, line, [{ ...version, ...change }]).status).toBe("UNKNOWN");
  });
  it("binds store, offer, variant, publication and exact modifier selection", () => {
    for (const change of [{ storeId: "foreign" }, { offerReference: "foreign" }, { variantReference: "foreign" }, { publicationVersion: "pub2" }, { modifiers: [{ optionReference: "extra", quantity: 1 }] }]) expect(classify({ ...entry, ...change }).status).toBe("UNKNOWN");
    const modifiers = [{ optionReference: "extra", quantity: 2 }]; expect(classify({ ...entry, modifiers }, { ...line, modifiers }).sizeClass).toBe("SMALL");
  });
  it("normalizes persisted modifier evidence without using database metadata as selection meaning", () => {
    const modifiers = [{ optionReference: "gift", quantity: 1 }, { optionReference: "wrap", quantity: 2 }];
    const persisted = [{ id: "db-wrap", optionReference: "wrap", quantity: 2, groupReference: "packaging", priceDelta: "1.00" }, { id: "db-gift", optionReference: "gift", quantity: 1, groupReference: "extras", priceDelta: "0.50" }];
    expect(classify({ ...entry, modifiers }, { ...line, modifiers: persisted }).sizeClass).toBe("SMALL");
    expect(classify({ ...entry, modifiers }, { ...line, modifiers: [{ ...persisted[0], quantity: 1 }, persisted[1]] }).status).toBe("UNKNOWN");
  });
  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid source quantity (%s)", (quantity) => { expect(classify(entry, { ...line, quantity }).status).toBe("UNSUPPORTED"); });
  it("leaves all multiple units and line groups unknown without inventing a packing algorithm", () => {
    expect(classify(entry, { ...line, quantity: 2 })).toMatchObject({ status: "UNKNOWN", reason: "AGGREGATE_PACKING_APPROVAL_REQUIRED" });
    expect(classifyTrustedMarketplaceParcel({ storeId: "store", lines: [line, line], versions: [version], profiles, now }).status).toBe("UNKNOWN");
  });
  it("fails closed for missing, conflicting and nonmonotonic parcel profiles", () => {
    for (const limits of [profiles.slice(0, 2), [...profiles, profiles[0]], [profiles[0], { ...profiles[1], maximumWeightKg: 4 }, profiles[2]]]) expect(classify(entry, line, [version], limits).status).toBe("UNKNOWN");
  });
  it("selects the latest effective full packaging snapshot, never an older cheaper binding", () => {
    expect(classify(entry, line, [version, { ...version, version: 2, packages: [{ ...entry, weightKg: 12 }] }]).sizeClass).toBe("LARGE");
  });
  it("selects exact size tariff but unknown source requires a separately approved explicit ANY row", () => {
    const matrix: DeliveryPolicyVersion = { ...version, rules: [{ key: "SMALL_ONLY", sizeClass: "SMALL", minDistanceKm: 0, maxDistanceKm: 30, province: "Gauteng", regionId: null, storeId: null, fee: "10.00", highRiskSurcharge: "0.00", minimumFee: "0.00", maximumFee: null }] };
    const context = { distanceKm: 10, province: "Gauteng", regionId: "region", storeId: "store", highRisk: false, now };
    expect(selectMarketplaceDeliveryPolicy([matrix], { ...context, sizeClass: classify().sizeClass }).fee).toBe("10.00");
    expect(() => selectMarketplaceDeliveryPolicy([matrix], { ...context, sizeClass: null })).toThrow("No approved marketplace delivery tariff");
    expect(selectMarketplaceDeliveryPolicy([{ ...matrix, rules: [{ ...matrix.rules[0], key: "EXPLICIT_ANY", sizeClass: "ANY" }] }], { ...context, sizeClass: null }).fee).toBe("10.00");
  });
});
