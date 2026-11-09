import { describe, expect, it } from "vitest";
import {
  customerCheckoutAddressPrefill,
  selectableCustomerAddresses,
  type CustomerCheckoutSavedAddress,
} from "@/lib/marketplace-checkout/customer-checkout-prefill";

const address: CustomerCheckoutSavedAddress = {
  id: "customer-default", type: "CUSTOMER", label: "Home", isDefault: true,
  contactName: "Customer Recipient", contactPhone: "0821111111",
  line1: "15 Example Street", line2: "Flat 2", city: "Johannesburg",
  province: "Gauteng", postalCode: "2000", country: "South Africa",
  accessNotes: "Reception", formattedAddress: "15 Example Street, Johannesburg, South Africa",
  placeId: "ChIJexample123", latitude: -26.2041, longitude: 28.0473,
};

describe("same-account marketplace checkout address prefill", () => {
  it("prefers a default customer/delivery address over a nondefault pickup", () => {
    const results = selectableCustomerAddresses([
      { ...address, id: "pickup", type: "PICKUP", isDefault: false },
      address,
    ]);
    expect(results.map(item => item.id)).toEqual(["customer-default", "pickup"]);
  });

  it("rejects incomplete and non-SA address book entries", () => {
    expect(selectableCustomerAddresses([
      { ...address, id: "wrong-country", country: "Zimbabwe" },
      { ...address, id: "empty", line1: "" },
    ])).toEqual([]);
  });

  it("accepts South African ISO country codes in saved checkout addresses", () => {
    const entries = selectableCustomerAddresses([
      { ...address, id: "iso2", country: "ZA" },
      { ...address, id: "iso3", country: "RSA" },
      { ...address, id: "iso3z", country: " ZAF " },
      { ...address, id: "full", country: "South Africa" },
      { ...address, id: "foreign", country: "Zimbabwe" },
    ]);
    expect(new Set(entries.map(item => item.id))).toEqual(new Set(["iso2", "iso3", "iso3z", "full"]));
  });

  it("fills checkout's contact-address fields without losing a valid map pin", () => {
    expect(customerCheckoutAddressPrefill(address)).toMatchObject({
      line1: "15 Example Street", line2: "Flat 2", city: "Johannesburg",
      province: "Gauteng", postalCode: "2000", instructions: "Reception",
      mapped: { placeId: "ChIJexample123", latitude: -26.2041, longitude: 28.0473 },
    });
  });

  it("never fabricates a map confirmation from manual or stale data", () => {
    for (const override of [
      { placeId: null },
      { latitude: null },
      { longitude: null },
      { latitude: 500 },
      { latitude: 0, longitude: 0 },
    ]) {
      expect(customerCheckoutAddressPrefill({ ...address, ...override }).mapped).toBeNull();
    }
  });

  it("does not mutate persisted address-book objects", () => {
    const input = Object.freeze({ ...address });
    selectableCustomerAddresses([input]);
    customerCheckoutAddressPrefill(input);
    expect(input).toEqual(address);
  });
});
