import { describe, expect, it } from "vitest";
import { completeStorePickupAddress, selectStorePickupAddress, storePickupSetupState } from "@/lib/marketplace-checkout/store-pickup-selection";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";

const depot = {
  id: "depot",
  storeId: "store-1",
  type: "PICKUP",
  isDefault: false,
  line1: "123 Main Road",
  city: "Johannesburg",
  province: "Gauteng",
  country: "South Africa",
};

describe("production marketplace collection address readiness", () => {
  it("selects the complete explicitly configured default pickup", () => {
    expect(selectStorePickupAddress("store-1", depot, [])).toEqual(depot);
  });
  it("does not let an incomplete default shadow a complete saved pickup", () => {
    const incomplete = { ...depot, line1: "", id: "broken", isDefault: true };
    expect(selectStorePickupAddress("store-1", incomplete, [incomplete, depot])).toEqual(depot);
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
  it("allows text-only genuine addresses for independent provider verification", () => {
    expect(selectStorePickupAddress("store-1", { ...depot }, [])).toEqual(depot);
  });
  it("does not display an imported business address as courier pickup-ready", () => {
    expect(storePickupSetupState(null, { line1: "45 Main Road" })).toEqual({
      setupRequired: true,
      legacyConfirmationRequired: true,
      savedPickupConfigured: false,
    });
    expect(storePickupSetupState(null, null).setupRequired).toBe(true);
    expect(storePickupSetupState(depot, { line1: "45 Main Road" })).toEqual({
      setupRequired: false,
      legacyConfirmationRequired: false,
      savedPickupConfigured: true,
    });
  });
  it("prevents saving pickup records that checkout cannot use", () => {
    const valid = { line1: depot.line1, city: depot.city, province: depot.province, country: depot.country };
    expect(StorePickupAddressSchema.safeParse(valid).success).toBe(true);
    expect(StorePickupAddressSchema.safeParse({ line1: depot.line1, city: depot.city, province: depot.province }).success).toBe(true);
    for (const patch of [{ city: null }, { province: null }, { city: "" }, { province: " " }, { country: "United States" }]) {
      expect(StorePickupAddressSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
    }
    expect(StorePickupAddressSchema.safeParse({ line1: depot.line1 }).success).toBe(false);
  });
});
