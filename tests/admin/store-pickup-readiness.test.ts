import { describe, expect, it } from "vitest";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";

const completePickup = { line1: "123 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng", country: "South Africa", postalCode: "2000", latitude: -26.2, longitude: 28.04 };

describe("read-only store collection address readiness", () => {
  it("flags stores without a saved, checkout-selected pickup", () => {
    expect(describeStoreCollectionEvidence(null)).toEqual({
      checkoutPickupConfigured: false,
      missing: ["Saved collection address missing"],
    });
  });

  it("reports missing suburb, postal and location evidence independently", () => {
    expect(describeStoreCollectionEvidence({ ...completePickup, line2: "", postalCode: "", latitude: null, longitude: null })).toEqual({
      checkoutPickupConfigured: false,
      missing: ["Suburb / area missing", "Postal code missing", "Map coordinates missing"],
    });
  });

  it("accepts a complete saved pickup and decimal-like map coordinates without declaring delivery coverage", () => {
    expect(describeStoreCollectionEvidence({ ...completePickup, latitude: { toString: () => "-26.2041" }, longitude: { toString: () => "28.0473" } })).toEqual({
      checkoutPickupConfigured: true,
      missing: [],
    });
  });

  it("recognizes existing ZA/RSA/ZAF merchant country values without inventing coverage", () => {
    for (const country of ["ZA", " rsa ", "ZAF", "south africa"]) {
      expect(describeStoreCollectionEvidence({ ...completePickup, country })).toEqual({
        checkoutPickupConfigured: true, missing: [],
      });
    }
    expect(describeStoreCollectionEvidence({ ...completePickup, country: "US" }).missing).toContain("Country not supported");
  });

  it("rejects invalid or unmapped coordinates as setup evidence", () => {
    for (const location of [{latitude:0,longitude:0},{latitude:null,longitude:28},{latitude:101,longitude:28},{latitude: -26, longitude: Infinity}]) {
      expect(describeStoreCollectionEvidence({ ...completePickup, ...location }).missing).toContain("Map coordinates missing");
    }
  });
});
