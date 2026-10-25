import { describe, expect, it } from "vitest";
import { TrustedPackageDraftSchema } from "@/lib/marketplace-checkout/parcel-configuration.service";

const unit = {
  storeId: "store", offerReference: "offer", variantReference: "variant",
  publicationVersion: "3", modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT" as const,
  lengthCm: 20, widthCm: 15, heightCm: 10, weightKg: 2,
  authorityReference: "proof:real-measurement",
};
const line = { offerReference: "offer", variantReference: "variant", publicationVersion: "3", quantity: 2, modifiers: [] };
const bundle = { storeId: "store", packingRule: "MEASURED_SEALED_CONSIGNMENT" as const, lines: [line], lengthCm: 34, widthCm: 22, heightCm: 11, weightKg: 4, authorityReference: "proof:sealed-measurement" };
const draft = { expectedVersion: 0, effectiveFrom: "2026-10-25T00:00:00.000Z", effectiveTo: null, reason: "Independently measured package", packages: [unit], bundles: [bundle] };

describe("write-time marketplace package authoring validation", () => {
  it("rejects duplicate single-unit evidence before a corrupt version is persisted", () => {
    const result = TrustedPackageDraftSchema.safeParse({ ...draft, packages: [unit, unit] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.message).join(" ")).toMatch(/single-packaged.*one reviewed measurement/i);
  });
  it("rejects duplicate measured consignments before a corrupt version is persisted", () => {
    const result = TrustedPackageDraftSchema.safeParse({ ...draft, bundles: [bundle, { ...bundle, lines: [...bundle.lines].reverse() }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.message).join(" ")).toMatch(/sealed consignment.*unambiguous/i);
  });
  it("preserves a distinct complete draft with one exact unit and one distinct sealed consignment", () => {
    expect(TrustedPackageDraftSchema.safeParse(draft).success).toBe(true);
  });
});
