import { PricingError } from "./errors";
import type { PricingRule, Prisma } from "@/types/db";

export type CommercialServiceTier =
  | "STANDARD_COURIER"
  | "EXPRESS_SAME_DAY"
  | "SCHEDULED_DELIVERY"
  | "HEAVY_PARCEL"
  | "DOCUMENTS_ONLY";

export type CommercialRuleReviewStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "SUSPENDED"
  | "RETIRED";

export interface CommercialServiceDescriptor {
  readonly tier: CommercialServiceTier;
  readonly code: string;
  readonly displayName: string;
  readonly requiresApproval: boolean;
  readonly defaultReviewStatus: CommercialRuleReviewStatus;
  readonly maxAllowedDistanceKm: number;
  readonly maxAllowedWeightKg: number;
}

export const COMMERCIAL_SERVICE_TAXONOMY: Record<CommercialServiceTier, CommercialServiceDescriptor> = {
  STANDARD_COURIER: {
    tier: "STANDARD_COURIER",
    code: "SVC-STD-01",
    displayName: "Standard Courier Delivery",
    requiresApproval: true,
    defaultReviewStatus: "APPROVED",
    maxAllowedDistanceKm: 500,
    maxAllowedWeightKg: 50,
  },
  EXPRESS_SAME_DAY: {
    tier: "EXPRESS_SAME_DAY",
    code: "SVC-EXP-01",
    displayName: "Express Same-Day Delivery",
    requiresApproval: true,
    defaultReviewStatus: "APPROVED",
    maxAllowedDistanceKm: 150,
    maxAllowedWeightKg: 25,
  },
  SCHEDULED_DELIVERY: {
    tier: "SCHEDULED_DELIVERY",
    code: "SVC-SCH-01",
    displayName: "Scheduled Window Delivery",
    requiresApproval: true,
    defaultReviewStatus: "APPROVED",
    maxAllowedDistanceKm: 300,
    maxAllowedWeightKg: 50,
  },
  HEAVY_PARCEL: {
    tier: "HEAVY_PARCEL",
    code: "SVC-HVY-01",
    displayName: "Heavy Parcel & Bulk Cargo",
    requiresApproval: true,
    defaultReviewStatus: "PENDING_REVIEW", // Inactive pending commercial sign-off
    maxAllowedDistanceKm: 1000,
    maxAllowedWeightKg: 500,
  },
  DOCUMENTS_ONLY: {
    tier: "DOCUMENTS_ONLY",
    code: "SVC-DOC-01",
    displayName: "Secure Documents & Letters",
    requiresApproval: true,
    defaultReviewStatus: "APPROVED",
    maxAllowedDistanceKm: 200,
    maxAllowedWeightKg: 2,
  },
};

/**
 * Asserts that a commercial pricing rule is approved and valid.
 * Fails closed: unapproved, inactive, archived, or mismatched currency rules trigger explicit errors.
 * Never allows silent fallback guessing.
 */
export function assertCommercialPricingRuleApproved(rule: PricingRule, now: Date = new Date()): void {
  if (!rule.active) {
    throw new PricingError(
      "INACTIVE_COMMERCIAL_RULE",
      `Commercial pricing rule ${rule.id} is inactive and cannot be used for rating.`,
      422,
    );
  }

  if (rule.archivedAt) {
    throw new PricingError(
      "ARCHIVED_COMMERCIAL_RULE",
      `Commercial pricing rule ${rule.id} has been archived.`,
      422,
    );
  }

  if (rule.currency !== "ZAR") {
    throw new PricingError(
      "CURRENCY_UNSUPPORTED",
      `Commercial pricing rule ${rule.id} has unsupported currency: ${rule.currency}. Only ZAR is supported.`,
      422,
    );
  }

  if (rule.effectiveFrom && rule.effectiveFrom > now) {
    throw new PricingError(
      "COMMERCIAL_RULE_NOT_YET_EFFECTIVE",
      `Commercial pricing rule ${rule.id} is not effective until ${rule.effectiveFrom.toISOString()}.`,
      422,
    );
  }

  if (rule.effectiveTo && rule.effectiveTo <= now) {
    throw new PricingError(
      "COMMERCIAL_RULE_EXPIRED",
      `Commercial pricing rule ${rule.id} expired at ${rule.effectiveTo.toISOString()}.`,
      422,
    );
  }
}

/**
 * Validates that mathematical pricing rule constraints are sound and non-negative.
 * Prevents configuration corruption from causing negative prices or invalid divisions.
 */
export function validateCommercialPricingRuleIntegrity(rule: {
  basePrice: Prisma.Decimal | number;
  perKmRate?: Prisma.Decimal | number | null;
  perKgRate?: Prisma.Decimal | number | null;
  minimumCharge?: Prisma.Decimal | number | null;
  minimumWeightKg?: Prisma.Decimal | number | null;
  maximumWeightKg?: Prisma.Decimal | number | null;
  minDistanceKm?: Prisma.Decimal | number | null;
  maxDistanceKm?: Prisma.Decimal | number | null;
}): void {
  const basePrice = Number(rule.basePrice);
  if (isNaN(basePrice) || basePrice < 0) {
    throw new PricingError("INVALID_PRICING_RULE", "Base price must be a non-negative number.");
  }

  if (rule.perKmRate !== undefined && rule.perKmRate !== null) {
    const perKm = Number(rule.perKmRate);
    if (isNaN(perKm) || perKm < 0) {
      throw new PricingError("INVALID_PRICING_RULE", "Per-km rate must be a non-negative number.");
    }
  }

  if (rule.perKgRate !== undefined && rule.perKgRate !== null) {
    const perKg = Number(rule.perKgRate);
    if (isNaN(perKg) || perKg < 0) {
      throw new PricingError("INVALID_PRICING_RULE", "Per-kg rate must be a non-negative number.");
    }
  }

  if (rule.minimumCharge !== undefined && rule.minimumCharge !== null) {
    const minCharge = Number(rule.minimumCharge);
    if (isNaN(minCharge) || minCharge < 0) {
      throw new PricingError("INVALID_PRICING_RULE", "Minimum charge must be a non-negative number.");
    }
  }

  if (rule.minimumWeightKg && rule.maximumWeightKg) {
    const minW = Number(rule.minimumWeightKg);
    const maxW = Number(rule.maximumWeightKg);
    if (minW > maxW) {
      throw new PricingError("INVALID_PRICING_RULE", "Minimum weight cannot exceed maximum weight.");
    }
  }

  if (rule.minDistanceKm && rule.maxDistanceKm) {
    const minD = Number(rule.minDistanceKm);
    const maxD = Number(rule.maxDistanceKm);
    if (minD > maxD) {
      throw new PricingError("INVALID_PRICING_RULE", "Minimum distance cannot exceed maximum distance.");
    }
  }
}

/**
 * Asserts that a service tier has approved commercial backing and does not fallback silently.
 */
export function assertCommercialServiceAvailable(tier: CommercialServiceTier): CommercialServiceDescriptor {
  const descriptor = COMMERCIAL_SERVICE_TAXONOMY[tier];
  if (!descriptor) {
    throw new PricingError(
      "UNKNOWN_SERVICE_TIER",
      `Commercial service tier ${tier} is not recognized by platform taxonomy.`,
      422,
    );
  }

  if (descriptor.defaultReviewStatus !== "APPROVED") {
    throw new PricingError(
      "SERVICE_TIER_LOCKED",
      `Commercial service tier ${tier} is pending approval (${descriptor.defaultReviewStatus}) and cannot be rated.`,
      422,
    );
  }

  return descriptor;
}
