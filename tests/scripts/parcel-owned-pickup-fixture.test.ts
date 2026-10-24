import { describe, expect, it } from "vitest";
import { selectStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
import { makeDisposableParcelPickupAddress } from "@/scripts/phase3-owned-pickup-fixture";

describe("disposable parcel acceptance pickup fixture", () => {
  const seed = { storeId: "seed-store", type: "PICKUP", line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2041, longitude: 28.0473, isDefault: true };
  it("builds a complete pickup owned by the fresh store, not the seed store", () => {
    const result = makeDisposableParcelPickupAddress("disposable-store", seed);
    expect(result).toMatchObject({storeId:"disposable-store",type:"PICKUP",isDefault:true,line1:seed.line1,latitude:seed.latitude,longitude:seed.longitude});
    expect(selectStorePickupAddress("disposable-store",result,[])).toEqual(result);
    expect(selectStorePickupAddress("seed-store",result,[])).toBeNull();
  });
  it("fails closed for incomplete or non-pickup seed evidence", () => {
    expect(() => makeDisposableParcelPickupAddress("disposable-store", {...seed,line1:""})).toThrow(/complete/i);
    expect(() => makeDisposableParcelPickupAddress("disposable-store", {...seed,type:"BUSINESS"})).toThrow(/pickup/i);
    expect(() => makeDisposableParcelPickupAddress("disposable-store", {...seed,latitude:null})).toThrow(/coordinates/i);
  });
  it("rejects reuse of the original owner's identity", () => {
    expect(() => makeDisposableParcelPickupAddress("seed-store",seed)).toThrow(/different/i);
  });
});
