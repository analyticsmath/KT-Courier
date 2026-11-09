import { describe, expect, it } from "vitest";
import { staleCustomerSavedAddressPinReset } from "@/lib/services/customer-address-map-authority";
import { SavedAddressUpdateSchema } from "@/lib/validation/address-book";

const old = {
  line1: "12 Main Road", line2: "Rosebank", city: "Johannesburg",
  province: "Gauteng", postalCode: "2196", country: "South Africa",
  formattedAddress: "12 Main Road, Rosebank, Johannesburg",
  placeId: "ChIJold-verified-address",
  latitude: -26.14, longitude: 28.04,
};

describe("customer saved-address map authority", () => {
  it("preserves a valid map point when the customer changes contact details only", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      contactPhone: "0821234567",
    }))).toBeNull();
  });

  it("invalidates the old pin and formatted address when the street changes without a new map selection", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      line1: "45 New Street",
    }))).toEqual({
      placeId: null, latitude: null, longitude: null, formattedAddress: null,
    });
  });

  it("invalidates the old pin when the suburb or postcode changes", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      line2: "Sunnyside", postalCode: "0002",
    }))).toMatchObject({ placeId: null, latitude: null, longitude: null });
  });

  it("invalidates stale placeId when a new pin position arrives without fresh placeId authority", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      latitude: -25.75, longitude: 28.19,
    }))).toMatchObject({ placeId: null, latitude: null, longitude: null });
  });

  it("accepts a complete replacement map selection for presentation", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      line1: "45 New Street", formattedAddress: "45 New Street, Pretoria",
      placeId: "ChIJnew-verified-address", latitude: -25.75, longitude: 28.19,
    }))).toBeNull();
  });

  it("clears all map proof on explicit pin deletion", () => {
    expect(staleCustomerSavedAddressPinReset(old, SavedAddressUpdateSchema.parse({
      placeId: null,
    }))).toMatchObject({ placeId: null, latitude: null, longitude: null });
  });

  it("does not confuse equivalent persisted decimal coordinates with changed map points", () => {
    const persisted = { ...old, latitude: { toString: () => "-26.14" }, longitude: { toString: () => "28.04" } };
    expect(staleCustomerSavedAddressPinReset(persisted, SavedAddressUpdateSchema.parse({
      latitude: -26.14, longitude: 28.04,
    }))).toBeNull();
  });
});
