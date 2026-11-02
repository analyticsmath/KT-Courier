import { describe, expect, it } from "vitest";
import { evaluateStorePickupPreflight, type StorePickupPreflightFacts } from "@/lib/admin/store-operational-preflight";

const ready: StorePickupPreflightFacts = {
  status: "ACTIVE", hasContact: true, pickupConfigured: true,
  suburbValid: true, postalCodeValid: true, mapCoordinatesValid: true, area: "COVERED", matchingServiceCount: 1,
};

describe("admin store collection and pickup-area preflight", () => {
  it("does not claim route or checkout certification after a valid pickup check", () => {
    const result = evaluateStorePickupPreflight(ready);
    expect(result).toMatchObject({ stage: "PICKUP_AREA_READY", blockers: [], checkoutCertified: false, routeVerified: false });
    expect(result.outstandingChecks).toEqual(expect.arrayContaining(["TRADING_HOURS_NOT_CONFIRMED", "DESTINATION_ROUTE_NOT_TESTED", "CHECKOUT_NOT_TESTED"]));
  });
  it("requires a saved checkout-owned collection address", () => {
    expect(evaluateStorePickupPreflight({ ...ready, pickupConfigured: false, area: "NOT_CHECKED", matchingServiceCount: 0 }).blockers).toEqual(["PICKUP_ADDRESS_MISSING"]);
  });
  it("retains onboarding status without pretending a pending store is live", () => {
    expect(evaluateStorePickupPreflight({ ...ready, status: "PENDING", pickupConfigured: false, area: "NOT_CHECKED", matchingServiceCount: 0 }).stage).toBe("DRAFT");
  });
  it("reports missing suburb, postal and map evidence before coverage", () => {
    expect(evaluateStorePickupPreflight({ ...ready, suburbValid: false, postalCodeValid: false, mapCoordinatesValid: false, area: "NOT_CHECKED", matchingServiceCount: 0 }).blockers).toEqual(["PICKUP_SUBURB_MISSING", "PICKUP_POSTAL_CODE_MISSING", "PICKUP_MAP_LOCATION_MISSING"]);
  });
  it("separates unverified pickup coverage from inactive courier service", () => {
    expect(evaluateStorePickupPreflight({ ...ready, area: "UNVERIFIED", matchingServiceCount: 0 }).blockers).toEqual(["PICKUP_COVERAGE_UNVERIFIED"]);
    expect(evaluateStorePickupPreflight({ ...ready, matchingServiceCount: 0 }).blockers).toEqual(["ACTIVE_COURIER_SERVICE_MISSING"]);
  });
  it("never treats a suspended store as eligible for new sales", () => {
    expect(evaluateStorePickupPreflight({ ...ready, status: "SUSPENDED" })).toMatchObject({ stage: "PAUSED", blockers: ["STORE_ACCOUNT_PAUSED"] });
  });
});
