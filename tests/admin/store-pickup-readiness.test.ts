import { describe, expect, it } from "vitest";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";

describe("read-only store collection address readiness", () => {
  it("flags stores without a saved, checkout-selected pickup", () => {
    expect(describeStoreCollectionEvidence(null)).toEqual({
      checkoutPickupConfigured: false,
      missing: ["Saved collection address missing"],
    });
  });

  it("reports missing postal and location evidence independently", () => {
    expect(describeStoreCollectionEvidence({ postalCode: "", latitude: null, longitude: null })).toEqual({
      checkoutPickupConfigured: true,
      missing: ["Postal code missing", "Map coordinates missing"],
    });
  });

  it("accepts postcode and decimal-like map coordinates without declaring delivery coverage", () => {
    expect(describeStoreCollectionEvidence({ postalCode: "2000", latitude: { toString: () => "-26.2041" }, longitude: { toString: () => "28.0473" } })).toEqual({
      checkoutPickupConfigured: true,
      missing: [],
    });
  });

  it("rejects invalid or unmapped coordinates as setup evidence", () => {
    for (const location of [{latitude:0,longitude:0},{latitude:null,longitude:28},{latitude:101,longitude:28},{latitude: -26, longitude: Infinity}]) {
      expect(describeStoreCollectionEvidence({ postalCode: "2000", ...location }).missing).toContain("Map coordinates missing");
    }
  });
});
