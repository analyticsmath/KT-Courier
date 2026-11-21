import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import {
  completeStorePickupAddress,
  isUnitOrBuildingLine2,
  resolveStorePickupSuburb,
} from "@/lib/marketplace-checkout/store-pickup-selection";
import { assertStoreParcelPickupMatches } from "@/lib/client-platform/store-parcel-pickup-authority";
import { hasStorePickupLocationChanged } from "@/lib/services/store-addresses.service";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import { isMerchantPickupEvidenceComplete } from "@/lib/store-presentation/merchant-pickup-evidence";
import { resolveVerifiedStorePickupCoordinates } from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";

const pickup = {
  line1: "55 Von Wielligh Street",
  line2: null,
  suburb: "Johannesburg Central",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2000",
  country: "South Africa",
  placeId: "verified_pickup_place_12345",
  latitude: -26.2041,
  longitude: 28.0473,
};

describe("store courier pickup and explicit suburb compatibility", () => {
  it("accepts a verified mapped pickup with an explicit suburb and no legacy line2", () => {
    const parsed = StorePickupAddressSchema.safeParse(pickup);
    expect(parsed.success).toBe(true);
    expect(completeStorePickupAddress({ ...pickup, type: "PICKUP", storeId: "owned-store" })).toBe(true);
    expect(describeStoreCollectionEvidence(pickup).checkoutPickupConfigured).toBe(true);
    expect(isMerchantPickupEvidenceComplete(pickup)).toBe(true);
    expect(() => assertStoreParcelPickupMatches(pickup, { ...pickup, type: "PICKUP", storeId: "owned-store" })).not.toThrow();
  });

  it("refuses empty locality and a changed pickup or forged map identity", () => {
    expect(StorePickupAddressSchema.safeParse({ ...pickup, suburb: null }).success).toBe(false);
    const saved = { ...pickup, type: "PICKUP", storeId: "owned-store" };
    expect(() => assertStoreParcelPickupMatches({ ...pickup, line1: "Other Street" }, saved)).toThrow();
    expect(() => assertStoreParcelPickupMatches({ ...pickup, suburb: "Other Suburb" }, saved)).toThrow();
    expect(() => assertStoreParcelPickupMatches({ ...pickup, placeId: "different_place" }, saved)).toThrow();
  });

  it("uses the same canonical suburb in fingerprints and verified geocoding", async () => {
    const canonical = { ...pickup, id: "pickup-1", storeId: "owned-store", type: "PICKUP" };
    const legacy = { ...canonical, line2: "Johannesburg Central", suburb: null };
    expect(pickupCertificationFingerprint(canonical)).toBe(pickupCertificationFingerprint(legacy));
    expect(pickupCertificationFingerprint({ ...canonical, suburb: "Rosebank" })).not.toBe(pickupCertificationFingerprint(legacy));
    const coords = await resolveVerifiedStorePickupCoordinates(canonical, async input => {
      expect(input.suburb).toBe("Johannesburg Central");
      expect(input.line2).toBeUndefined();
      return { latitude: pickup.latitude, longitude: pickup.longitude };
    });
    expect(coords).toEqual({ latitude: pickup.latitude, longitude: pickup.longitude });
  });

  it("preserves legacy line2 locality without falsely revoking contact-only pickup edits", () => {
    const legacy = { ...pickup, suburb: null, line2: "Johannesburg Central", type: "PICKUP" };
    expect(completeStorePickupAddress(legacy)).toBe(true);
    expect(() => assertStoreParcelPickupMatches({ ...pickup, line2: "Johannesburg Central", suburb: undefined }, legacy)).not.toThrow();
    const previous = { ...legacy, id: "pickup1", latitude: new Prisma.Decimal(pickup.latitude), longitude: new Prisma.Decimal(pickup.longitude) };
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: "Johannesburg Central" })).toBe(false);
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: null, suburb: "Johannesburg Central" })).toBe(false);
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: "Unit 4", suburb: "Johannesburg Central" })).toBe(true);
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: "Johannesburg Central", suburb: "Rosebank" })).toBe(true);
  });

  it("separates unit/building line2 from suburb and refuses unit-only line2 when suburb is missing (C05)", () => {
    expect(isUnitOrBuildingLine2("Unit 4B")).toBe(true);
    expect(isUnitOrBuildingLine2("Suite 12")).toBe(true);
    expect(isUnitOrBuildingLine2("Sandton")).toBe(false);

    const separated = { ...pickup, line2: "Unit 4B", suburb: "Sandton", type: "PICKUP" };
    expect(resolveStorePickupSuburb(separated)).toBe("Sandton");
    expect(completeStorePickupAddress(separated)).toBe(true);
    expect(describeStoreCollectionEvidence(separated)).toMatchObject({
      checkoutPickupConfigured: true,
      resolvedSuburb: "Sandton",
      usesLegacyLine2Suburb: false,
    });

    const unitOnlyMissingSuburb = { ...pickup, line2: "Unit 4B", suburb: null, type: "PICKUP" };
    expect(resolveStorePickupSuburb(unitOnlyMissingSuburb)).toBeNull();
    expect(completeStorePickupAddress(unitOnlyMissingSuburb)).toBe(false);
    expect(describeStoreCollectionEvidence(unitOnlyMissingSuburb)).toMatchObject({
      checkoutPickupConfigured: false,
      missing: ["Suburb / area missing"],
    });
  });
});
