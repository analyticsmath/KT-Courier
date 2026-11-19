import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import { completeStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
import { assertStoreParcelPickupMatches } from "@/lib/client-platform/store-parcel-pickup-authority";
import { hasStorePickupLocationChanged } from "@/lib/services/store-addresses.service";

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
    expect(() => assertStoreParcelPickupMatches(pickup, { ...pickup, type: "PICKUP", storeId: "owned-store" })).not.toThrow();
  });

  it("refuses empty locality and a changed pickup or forged map identity", () => {
    expect(StorePickupAddressSchema.safeParse({ ...pickup, suburb: null }).success).toBe(false);
    const saved = { ...pickup, type: "PICKUP", storeId: "owned-store" };
    expect(() => assertStoreParcelPickupMatches({ ...pickup, line1: "Other Street" }, saved)).toThrow();
    expect(() => assertStoreParcelPickupMatches({ ...pickup, suburb: "Other Suburb" }, saved)).toThrow();
    expect(() => assertStoreParcelPickupMatches({ ...pickup, placeId: "different_place" }, saved)).toThrow();
  });

  it("preserves legacy line2 locality without falsely revoking contact-only pickup edits", () => {
    const legacy = { ...pickup, suburb: null, line2: "Johannesburg Central", type: "PICKUP" };
    expect(completeStorePickupAddress(legacy)).toBe(true);
    expect(() => assertStoreParcelPickupMatches({ ...pickup, line2: "Johannesburg Central", suburb: undefined }, legacy)).not.toThrow();
    const previous = { ...legacy, id: "pickup1", latitude: new Prisma.Decimal(pickup.latitude), longitude: new Prisma.Decimal(pickup.longitude) };
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: "Johannesburg Central" })).toBe(false);
    expect(hasStorePickupLocationChanged(previous, { ...pickup, line2: "Johannesburg Central", suburb: "Rosebank" })).toBe(true);
  });
});
