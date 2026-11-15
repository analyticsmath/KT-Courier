/** A read-only preflight for merchant pickup eligibility, not a go-live permit. */
export type StorePickupPreflightFacts = Readonly<{
  status: string;
  hasContact: boolean;
  pickupConfigured: boolean;
  suburbValid: boolean;
  postalCodeValid: boolean;
  mapCoordinatesValid: boolean;
  area: "NOT_CHECKED" | "COVERED" | "UNVERIFIED";
  matchingServiceCount: number;
}>;

export type StorePickupPreflightResult = Readonly<{
  stage: "DRAFT" | "INCOMPLETE" | "PICKUP_AREA_READY" | "PAUSED";
  blockers: readonly string[];
  outstandingChecks: readonly string[];
  routeVerified: false;
  checkoutCertified: false;
}>;

const outstandingChecks = [
  "TRADING_HOURS_NOT_CONFIRMED",
  "DESTINATION_ROUTE_NOT_TESTED",
  "CHECKOUT_NOT_TESTED",
] as const;

export function evaluateStorePickupPreflight(facts: StorePickupPreflightFacts): StorePickupPreflightResult {
  if (facts.status === "SUSPENDED" || facts.status === "DISABLED") {
    return { stage: "PAUSED", blockers: ["STORE_ACCOUNT_PAUSED"], outstandingChecks, routeVerified: false, checkoutCertified: false };
  }
  const blockers: string[] = [];
  if (!facts.hasContact) blockers.push("STORE_CONTACT_MISSING");
  if (!facts.pickupConfigured) blockers.push("PICKUP_ADDRESS_MISSING");
  else {
    if (!facts.suburbValid) blockers.push("PICKUP_SUBURB_MISSING");
    if (!facts.postalCodeValid) blockers.push("PICKUP_POSTAL_CODE_MISSING");
    if (!facts.mapCoordinatesValid) blockers.push("PICKUP_MAP_LOCATION_MISSING");
    if (facts.suburbValid && facts.postalCodeValid && facts.mapCoordinatesValid) {
      if (facts.area !== "COVERED") blockers.push("PICKUP_COVERAGE_UNVERIFIED");
      else if (!Number.isSafeInteger(facts.matchingServiceCount) || facts.matchingServiceCount <= 0) blockers.push("ACTIVE_COURIER_SERVICE_MISSING");
    }
  }
  return {
    stage: facts.status === "PENDING" ? "DRAFT" : blockers.length ? "INCOMPLETE" : "PICKUP_AREA_READY",
    blockers,
    outstandingChecks,
    routeVerified: false,
    checkoutCertified: false,
  };
}

export const CHECKOUT_CAPABILITY_BLOCKER_CODES = [
  "MISSING_STREET",
  "MISSING_SUBURB",
  "MISSING_POSTCODE",
  "MISSING_MAP_PROOF",
  "UNAPPROVED_SELLER",
  "COVERAGE_INACTIVE",
  "ROUTE_UNVERIFIED",
  "SERVICE_INACTIVE",
  "POLICY_INACTIVE",
  "NO_SELLABLE_OFFER",
  "PAYMENT_PROVIDER_NOT_READY",
  "CERTIFICATION_STALE",
] as const;

export type CheckoutCapabilityBlockerCode = (typeof CHECKOUT_CAPABILITY_BLOCKER_CODES)[number];

export const CHECKOUT_CAPABILITY_BLOCKER_MESSAGES: Readonly<
  Record<CheckoutCapabilityBlockerCode, string>
> = Object.freeze({
  MISSING_STREET:
    "Save a complete South African street address, city, and province in the store's collection settings.",
  MISSING_SUBURB:
    "Add the suburb or locality (address line 2) to the store's saved collection address.",
  MISSING_POSTCODE:
    "Add a valid 4-digit South African postal code to the store's saved collection address.",
  MISSING_MAP_PROOF:
    "Confirm the collection point on the map so verified latitude, longitude, and place evidence are recorded.",
  UNAPPROVED_SELLER:
    "Submit seller legal identity and supporting verification evidence for independent administrator approval.",
  COVERAGE_INACTIVE:
    "The store's collection coordinates do not fall within an active, pricing-enabled delivery region.",
  ROUTE_UNVERIFIED:
    "Road-route feasibility from the store's collection point to a representative point in the covered region could not be verified.",
  SERVICE_INACTIVE:
    "No active courier service or parcel size profile currently supports this store's collection province and region.",
  POLICY_INACTIVE:
    "An active store order operational policy and approved store commission plan are required before checkout capability can be certified.",
  NO_SELLABLE_OFFER:
    "Create, approve, media-ready, stock, package, price in ZAR, and publish at least one eligible product offer before certifying live checkout capability.",
  PAYMENT_PROVIDER_NOT_READY:
    "Paystack payment provider configuration is not ready or has configuration issues.",
  CERTIFICATION_STALE:
    "The store's collection address, coverage region, active service, or commercial policy changed since the last certification; prepare and approve a fresh certification.",
});

export type IndependentReviewerStatus =
  | "NOT_PREPARED"
  | "PENDING_INDEPENDENT_REVIEW"
  | "SELF_APPROVAL_BLOCKED"
  | "APPROVED_CURRENT"
  | "STALE_OR_EXPIRED"
  | "REVOKED";

export type CheckoutCapabilityPreflightFacts = Readonly<{
  streetValid: boolean;
  suburbValid: boolean;
  postalCodeValid: boolean;
  mapProofValid: boolean;
  sellerApproved: boolean;
  coverageActive: boolean;
  routeVerified: boolean;
  serviceActive: boolean;
  policyActive: boolean;
  sellableOfferReady: boolean;
  paymentProviderReady: boolean;
  certificationStale: boolean;
  independentReviewerStatus: IndependentReviewerStatus;
}>;

export type CheckoutCapabilityEvaluation = Readonly<{
  preflightReady: boolean;
  liveReady: boolean;
  capabilityBlockers: readonly CheckoutCapabilityBlockerCode[];
  blockers: readonly CheckoutCapabilityBlockerCode[];
  blockerMessages: Readonly<Record<string, string>>;
  independentReviewerStatus: IndependentReviewerStatus;
}>;

export function evaluateCheckoutCapabilityPreflight(
  facts: CheckoutCapabilityPreflightFacts,
): CheckoutCapabilityEvaluation {
  const capabilityBlockers: CheckoutCapabilityBlockerCode[] = [];
  if (!facts.streetValid) capabilityBlockers.push("MISSING_STREET");
  if (!facts.suburbValid) capabilityBlockers.push("MISSING_SUBURB");
  if (!facts.postalCodeValid) capabilityBlockers.push("MISSING_POSTCODE");
  if (!facts.mapProofValid) capabilityBlockers.push("MISSING_MAP_PROOF");
  if (!facts.sellerApproved) capabilityBlockers.push("UNAPPROVED_SELLER");
  if (facts.streetValid && facts.suburbValid && facts.postalCodeValid && facts.mapProofValid) {
    if (!facts.coverageActive) {
      capabilityBlockers.push("COVERAGE_INACTIVE");
    } else {
      if (!facts.routeVerified) capabilityBlockers.push("ROUTE_UNVERIFIED");
      if (!facts.serviceActive) capabilityBlockers.push("SERVICE_INACTIVE");
    }
  } else {
    if (!facts.coverageActive) capabilityBlockers.push("COVERAGE_INACTIVE");
    if (!facts.routeVerified) capabilityBlockers.push("ROUTE_UNVERIFIED");
    if (!facts.serviceActive) capabilityBlockers.push("SERVICE_INACTIVE");
  }
  if (!facts.policyActive) capabilityBlockers.push("POLICY_INACTIVE");
  if (!facts.sellableOfferReady) capabilityBlockers.push("NO_SELLABLE_OFFER");
  if (!facts.paymentProviderReady) capabilityBlockers.push("PAYMENT_PROVIDER_NOT_READY");

  const blockers: CheckoutCapabilityBlockerCode[] = [...capabilityBlockers];
  if (facts.certificationStale && !blockers.includes("CERTIFICATION_STALE")) {
    blockers.push("CERTIFICATION_STALE");
  }

  const blockerMessages: Record<string, string> = {};
  for (const code of blockers) {
    blockerMessages[code] = CHECKOUT_CAPABILITY_BLOCKER_MESSAGES[code];
  }

  const preflightReady = capabilityBlockers.length === 0;
  const liveReady =
    preflightReady &&
    !facts.certificationStale &&
    facts.independentReviewerStatus === "APPROVED_CURRENT";

  return Object.freeze({
    preflightReady,
    liveReady,
    capabilityBlockers: Object.freeze(capabilityBlockers),
    blockers: Object.freeze(blockers),
    blockerMessages: Object.freeze(blockerMessages),
    independentReviewerStatus: facts.independentReviewerStatus,
  });
}
