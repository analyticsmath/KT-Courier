import { describe, expect, it } from "vitest";
import { completeStorePickupAddress, selectStorePickupAddress, storePickupSetupState } from "@/lib/marketplace-checkout/store-pickup-selection";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";

const depot = {
  id: "depot",
  storeId: "store-1",
  type: "PICKUP",
  isDefault: false,
  line1: "123 Main Road",
  line2: "Sandton",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2196",
  country: "South Africa",
  latitude: -26.1076,
  longitude: 28.0567,
};

describe("production marketplace collection address readiness", () => {
  it("selects the complete explicitly configured default pickup", () => {
    expect(selectStorePickupAddress("store-1", depot, [])).toEqual(depot);
  });
  it("does not let an incomplete default shadow a complete saved pickup", () => {
    const incomplete = { ...depot, line1: "", id: "broken", isDefault: true };
    expect(selectStorePickupAddress("store-1", incomplete, [incomplete, depot])).toEqual(depot);
    const missingSuburb = { ...depot, line2: null, id: "missing-suburb", isDefault: true };
    expect(selectStorePickupAddress("store-1", missingSuburb, [missingSuburb, depot])).toEqual(depot);
  });
  it("never treats an unrelated business default as a collection address", () => {
    const business = { ...depot, id: "business", type: "BUSINESS", isDefault: true };
    expect(selectStorePickupAddress("store-1", null, [business, depot])).toEqual(depot);
  });
  it("does not borrow another seller's pickup or accept incomplete data", () => {
    expect(selectStorePickupAddress("store-1", null, [{ ...depot, storeId: "store-2" }])).toBeNull();
    expect(selectStorePickupAddress("store-1", { ...depot, province: null }, [])).toBeNull();
    expect(selectStorePickupAddress("store-1", { ...depot, country: "United States" }, [])).toBeNull();
    expect(completeStorePickupAddress({ ...depot, city: "   " })).toBe(false);
  });
  it("requires a suburb, four-digit postal code and saved map marker before checkout selection", () => {
    for (const patch of [
      { line2: null },
      { postalCode: null },
      { postalCode: "200" },
      { latitude: null, longitude: null },
      { latitude: 0, longitude: 0 },
    ]) {
      expect(completeStorePickupAddress({ ...depot, ...patch })).toBe(false);
      expect(selectStorePickupAddress("store-1", { ...depot, ...patch }, [])).toBeNull();
    }
  });
  it("does not display an imported business address as courier pickup-ready", () => {
    expect(storePickupSetupState(null, { line1: "45 Main Road" })).toEqual({
      setupRequired: true,
      legacyConfirmationRequired: true,
      savedPickupConfigured: false,
    });
    expect(storePickupSetupState(null, null).setupRequired).toBe(true);
    expect(storePickupSetupState({ ...depot, city: null }, null)).toEqual({
      setupRequired: true,
      legacyConfirmationRequired: false,
      savedPickupConfigured: false,
    });
    expect(storePickupSetupState({ ...depot, line2: null }, null).setupRequired).toBe(true);
    expect(storePickupSetupState(depot, { line1: "45 Main Road" })).toEqual({
      setupRequired: false,
      legacyConfirmationRequired: false,
      savedPickupConfigured: true,
    });
  });
  it("prevents saving pickup records that checkout cannot use", () => {
    const valid = { line1: depot.line1, line2: depot.line2, city: depot.city, province: depot.province, postalCode: depot.postalCode, country: depot.country, latitude: depot.latitude, longitude: depot.longitude };
    expect(StorePickupAddressSchema.safeParse(valid).success).toBe(true);
    expect(StorePickupAddressSchema.safeParse({ ...valid, line2: null }).success).toBe(false);
    expect(StorePickupAddressSchema.safeParse({ ...valid, postalCode: null }).success).toBe(false);
    expect(StorePickupAddressSchema.safeParse({ ...valid, latitude: null, longitude: null }).success).toBe(false);
    for (const patch of [{ city: null }, { province: null }, { city: "" }, { province: " " }, { country: "United States" }]) {
      expect(StorePickupAddressSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
    expect(StorePickupAddressSchema.safeParse({ line1: depot.line1 }).success).toBe(false);
  });
});
