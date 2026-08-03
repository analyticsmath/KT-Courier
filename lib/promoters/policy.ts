import { PromoterError } from "./errors";

export const PROMOTER_TARGET_TYPES = ["CUSTOMER", "BUSINESS_CUSTOMER", "STORE"] as const;
/**
 * The enum retains this legacy value for migration compatibility only.  There
 * is deliberately no registration aggregate or qualification adapter behind it.
 */
export const BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE = "BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE" as const;
export const PROMOTER_QUALIFYING_EVENTS = [
  "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER",
  "CUSTOMER_FIRST_COMPLETED_SETTLED_MARKETPLACE_ORDER",
  "BUSINESS_FIRST_COMPLETED_SETTLED_ORDER",
  "STORE_FIRST_SETTLED_MARKETPLACE_ORDER",
] as const;

export function assertPromoterActivationEligibility(account: Readonly<{ status: string; identityStatus: string; taxProfileStatus: string; payoutReadinessStatus: string; agreementStatus: string }>) {
  if (account.status !== "APPROVED" || account.identityStatus !== "VERIFIED" || account.taxProfileStatus !== "READY" || account.payoutReadinessStatus !== "READY" || account.agreementStatus !== "ACCEPTED") {
    throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Agreement acceptance and compliance readiness are required before activation.");
  }
}

export function assertExactlyOneAttributionSubject(input: Readonly<{ customerUserId?: string | null; businessAccountId?: string | null; storeId?: string | null }>) {
  if ([input.customerUserId, input.businessAccountId, input.storeId].filter(Boolean).length !== 1) throw new PromoterError("PROMOTER_INVALID_COMMAND", "An attribution must bind exactly one new acquisition subject.");
}

export function assertPromoterTargetAvailable(targetType: string): asserts targetType is "CUSTOMER" | "STORE" {
  if (targetType === "BUSINESS_CUSTOMER") {
    throw new PromoterError(BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE, "Business-customer acquisition is not available until a canonical registration authority exists.");
  }
  if (targetType !== "CUSTOMER" && targetType !== "STORE") throw new PromoterError("PROMOTER_INVALID_COMMAND", "Unsupported promoter program target.");
}

export function assertInternalDestination(destinationType: string, destinationReference?: string | null) {
  if (destinationType === "BUSINESS_REGISTRATION") throw new PromoterError(BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE, "Business-customer referrals are not available.");
  if (!/^(CUSTOMER_REGISTRATION|STORE_APPLICATION)$/.test(destinationType) || (destinationReference && !/^[A-Za-z0-9._:-]{1,120}$/.test(destinationReference))) {
    throw new PromoterError("PROMOTER_INVALID_COMMAND", "Referral destinations must be approved internal registration routes.");
  }
}
