/** A read-only preflight for merchant pickup eligibility, not a go-live permit.
 * Actual customer destinations, trading hours, approval and payment still
 * require independent evidence before claiming that checkout works.
 */
export type StorePickupPreflightFacts = Readonly<{
  status: string;
  hasContact: boolean;
  pickupConfigured: boolean;
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
    if (!facts.postalCodeValid) blockers.push("PICKUP_POSTAL_CODE_MISSING");
    if (!facts.mapCoordinatesValid) blockers.push("PICKUP_MAP_LOCATION_MISSING");
    if (blockers.length === 0) {
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
