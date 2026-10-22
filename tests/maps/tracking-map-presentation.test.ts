import { describe, expect, it } from "vitest";
import { trackingMapPoints } from "@/lib/maps/tracking-map-presentation";
const location = { latitude: -26.2, longitude: 28.05, observedAt: "2026-10-06T11:30:00Z" };
const sampleNow = new Date("2026-10-06T11:30:30Z").getTime();
describe("owner-scoped tracking map presentation", () => {
  it("uses accepted active parcel evidence and clears ended tracking", () => {
    expect(trackingMapPoints({ data: { active: true, latestKnownLocation: location } }, "PARCEL", "order-a", sampleNow)).toEqual([{ ...location, id: "order-a", label: "Courier" }]);
    expect(trackingMapPoints({ data: { active: false, latestKnownLocation: location } }, "PARCEL", "order-a", sampleNow)).toEqual([]);
  });
  it("requires the correct marketplace order and never substitutes a location", () => {
    const body = { marketplaceOrderReference: "order-a", storeOrders: [{ storeOrderReference: "store-a", storeName: "My store", liveLocation: location }, { storeOrderReference: "store-b", storeName: "Other store", liveLocation: null }] };
    expect(trackingMapPoints(body, "MARKETPLACE", "order-a", sampleNow)).toEqual([{ ...location, id: "store-a", label: "My store" }]);
    expect(trackingMapPoints(body, "MARKETPLACE", "order-b", sampleNow)).toEqual([]);
  });
  it("never presents stale accepted GPS as a current courier position", () => {
    const sampleAt = new Date("2026-10-06T11:30:00Z").getTime();
    expect(trackingMapPoints({ data: { active: true, latestKnownLocation: location } }, "PARCEL", "order-a", sampleAt + 4 * 60_000)).toEqual([]);
    expect(trackingMapPoints({ data: { active: true, latestKnownLocation: location } }, "PARCEL", "order-a", sampleAt + 30_000)).toHaveLength(1);
  });
  it("never displays a future-dated courier GPS fix", () => {
    const sampleAt = new Date("2026-10-06T11:30:00Z").getTime();
    expect(trackingMapPoints({ data: { active: true, latestKnownLocation: location } }, "PARCEL", "order-a", sampleAt - 3 * 60_000)).toEqual([]);
  });
  it.each([{ ...location, latitude: 95 }, { ...location, longitude: Number.NaN }, { ...location, observedAt: "unknown" }])("rejects invalid location evidence", invalid => {
    expect(trackingMapPoints({ data: { active: true, latestKnownLocation: invalid } }, "PARCEL", "order-a", sampleNow)).toEqual([]);
  });
});
