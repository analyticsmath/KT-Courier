import { describe, expect, it } from "vitest";
import {
  CHECKOUT_CAPABILITY_BLOCKER_CODES,
  evaluateCheckoutCapabilityPreflight,
  evaluateStorePickupPreflight,
  type CheckoutCapabilityPreflightFacts,
  type StorePickupPreflightFacts,
} from "@/lib/admin/store-operational-preflight";
import { isStoreOnboardingOwnerOfferPrepared, type StoreOnboardingOwnerOfferFacts } from "@/lib/services/store-onboarding.service";

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

const readyCapability: CheckoutCapabilityPreflightFacts = {
  streetValid: true,
  suburbValid: true,
  postalCodeValid: true,
  mapProofValid: true,
  sellerApproved: true,
  coverageActive: true,
  routeVerified: true,
  serviceActive: true,
  policyActive: true,
  sellableOfferReady: true,
  paymentProviderReady: true,
  certificationStale: false,
  independentReviewerStatus: "APPROVED_CURRENT",
};

describe("§4.1 CheckoutCapabilityPreflight blocker taxonomy and independent reviewer status", () => {
  it("reports preflightReady=true and liveReady=true when all capabilities pass and independent review is current", () => {
    const res = evaluateCheckoutCapabilityPreflight(readyCapability);
    expect(res).toMatchObject({
      preflightReady: true,
      liveReady: true,
      capabilityBlockers: [],
      blockers: [],
      independentReviewerStatus: "APPROVED_CURRENT",
    });
  });

  it("exposes every required blocker code with actionable merchant repair messages", () => {
    const res = evaluateCheckoutCapabilityPreflight({
      streetValid: false,
      suburbValid: false,
      postalCodeValid: false,
      mapProofValid: false,
      sellerApproved: false,
      coverageActive: false,
      routeVerified: false,
      serviceActive: false,
      policyActive: false,
      sellableOfferReady: false,
      paymentProviderReady: false,
      certificationStale: true,
      independentReviewerStatus: "STALE_OR_EXPIRED",
    });
    expect(res.preflightReady).toBe(false);
    expect(res.liveReady).toBe(false);
    expect(res.blockers).toEqual(CHECKOUT_CAPABILITY_BLOCKER_CODES);
    for (const code of CHECKOUT_CAPABILITY_BLOCKER_CODES) {
      expect(res.blockerMessages[code]?.length).toBeGreaterThan(20);
    }
  });

  it("allows preflight preparation when capability blockers are empty even if prior certification is stale", () => {
    const res = evaluateCheckoutCapabilityPreflight({
      ...readyCapability,
      certificationStale: true,
      independentReviewerStatus: "STALE_OR_EXPIRED",
    });
    expect(res.preflightReady).toBe(true);
    expect(res.liveReady).toBe(false);
    expect(res.capabilityBlockers).toEqual([]);
    expect(res.blockers).toEqual(["CERTIFICATION_STALE"]);
  });

  it("blocks checkout capability preflight with NO_SELLABLE_OFFER when the store has no eligible published offer", () => {
    const res = evaluateCheckoutCapabilityPreflight({
      ...readyCapability,
      sellableOfferReady: false,
    });
    expect(res.preflightReady).toBe(false);
    expect(res.liveReady).toBe(false);
    expect(res.capabilityBlockers).toEqual(["NO_SELLABLE_OFFER"]);
    expect(res.blockerMessages.NO_SELLABLE_OFFER).toMatch(/publish at least one eligible product offer/i);
  });
});

describe("E01 dynamic store pickup preflight operating hours, route and checkout states", () => {
  it("reports CONFIGURED operating hours with physicalSiteConfirmed=false and drops TRADING_HOURS_NOT_CONFIRMED once valid hours are saved", () => {
    const result = evaluateStorePickupPreflight({
      ...ready,
      operatingHours: {
        timezone: "Africa/Johannesburg",
        days: {
          monday: { open: "08:30", close: "17:00", closed: false },
          tuesday: { open: "08:30", close: "17:00", closed: false },
          wednesday: { open: "08:30", close: "17:00", closed: false },
          thursday: { open: "08:30", close: "17:00", closed: false },
          friday: { open: "08:30", close: "17:00", closed: false },
          saturday: { open: "09:00", close: "13:00", closed: false },
          sunday: { closed: true },
        },
      },
      routeVerified: true,
      checkoutCertified: true,
      independentHoursReviewRecorded: true,
    });
    expect(result.operatingHoursState.status).toBe("CONFIGURED");
    expect(result.operatingHoursState.physicalSiteConfirmed).toBe(false);
    expect(result.operatingHoursState.independentReviewRecorded).toBe(true);
    expect(result.operatingHoursState.summary).toContain("Mon: 08:30-17:00");
    expect(result.routeVerified).toBe(true);
    expect(result.checkoutCertified).toBe(true);
    expect(result.outstandingChecks).toEqual([]);
  });

  it("distinguishes malformed operatingHours with TRADING_HOURS_INVALID", () => {
    const result = evaluateStorePickupPreflight({
      ...ready,
      operatingHours: { timezone: "", bad: true },
      routeVerified: false,
      checkoutCertified: false,
    });
    expect(result.operatingHoursState).toEqual({
      status: "INVALID",
      summary: null,
      physicalSiteConfirmed: false,
      independentReviewRecorded: false,
    });
    expect(result.outstandingChecks).toEqual([
      "TRADING_HOURS_INVALID",
      "DESTINATION_ROUTE_NOT_TESTED",
      "CHECKOUT_NOT_TESTED",
    ]);
  });

  it("treats active variant + approved/active product + active or submitted offer as prepared during store onboarding", () => {
    const baseOffer: StoreOnboardingOwnerOfferFacts = {
      isStoreOwnedProduct: true,
      productStatus: "ACTIVE",
      productModerationStatus: "APPROVED",
      productTypeActive: true,
      categoryActive: true,
      variantStatus: "ACTIVE",
      productMedia: [
        {
          role: "PRIMARY",
          variantId: null,
          assetStatus: "READY",
          privacyInspectionPassed: true,
          storageConfirmed: true,
          validated: true,
        },
      ],
      variantId: "var_1",
      offerStatus: "ACTIVE",
      fulfilmentMode: "COURIER_DELIVERY",
      minimumQuantity: 1,
      hasCurrentZarPrice: true,
      hasInventoryItem: true,
      inventoryTrackingMode: "TRACKED",
      allowBackorder: false,
      activeLocationAvailableStock: 30,
      hasPackageDeclaration: true,
    };
    expect(isStoreOnboardingOwnerOfferPrepared(baseOffer)).toBe(true);
    expect(isStoreOnboardingOwnerOfferPrepared({ ...baseOffer, offerStatus: "DRAFT" })).toBe(false);
    expect(isStoreOnboardingOwnerOfferPrepared({ ...baseOffer, variantStatus: "DRAFT", offerStatus: "SUBMITTED" })).toBe(true);
  });
});
