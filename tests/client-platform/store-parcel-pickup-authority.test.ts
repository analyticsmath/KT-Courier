import { describe, expect, it } from "vitest";
import { assertStoreParcelPickupMatches } from "@/lib/client-platform/store-parcel-pickup-authority";

const saved = {
  id: "saved-pickup", storeId: "store-1", type: "PICKUP",
  line1: "11 Main Street", line2: "Rosebank", city: "Johannesburg",
  province: "Gauteng", postalCode: "2196", country: "South Africa",
  placeId: "place-rosebank-verified", latitude: -26.145, longitude: 28.044,
};
describe("merchant outbound parcel collection authority", () => {
  it("permits the store's own complete mapped saved collection location", () => {
    expect(() => assertStoreParcelPickupMatches(saved, saved)).not.toThrow();
  });
  it("rejects an incomplete saved pickup despite client-supplied coordinates", () => {
    expect(() => assertStoreParcelPickupMatches(saved, { ...saved, latitude: null }))
      .toThrowError(expect.objectContaining({ code: "STORE_PICKUP_NOT_CONFIGURED" }));
  });
  it("rejects a wrong-type saved collection address", () => {
    expect(() => assertStoreParcelPickupMatches(saved, { ...saved, type: "DROPOFF" }))
      .toThrowError(expect.objectContaining({ code: "STORE_PICKUP_NOT_CONFIGURED" }));
  });
  it("rejects arbitrary collection addresses even when the saved address is valid", () => {
    expect(() => assertStoreParcelPickupMatches({ ...saved, line1: "99 Different Street" }, saved))
      .toThrowError(expect.objectContaining({ code: "STORE_PICKUP_CHANGED" }));
  });
  it("rejects mismatched mapping identity and locality", () => {
    expect(() => assertStoreParcelPickupMatches({ ...saved, placeId: "another-place" }, saved))
      .toThrowError(expect.objectContaining({ code: "STORE_PICKUP_CHANGED" }));
  });
  it("accepts inconsequential case and whitespace normalization", () => {
    expect(() => assertStoreParcelPickupMatches({ ...saved, line1: " 11  MAIN STREET " }, saved)).not.toThrow();
  });
});
