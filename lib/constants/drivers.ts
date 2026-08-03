import { DriverStatus, DriverAvailability, DriverOnboardingStatus } from "@/types/db";

// Enums and display mappings
export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

export const DRIVER_AVAILABILITY_LABELS: Record<DriverAvailability, string> = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  ON_DELIVERY: "On Delivery",
  OFFLINE: "Offline",
};

export const DRIVER_ONBOARDING_LABELS: Record<DriverOnboardingStatus, string> = {
  INVITED: "Invited",
  PROFILE_INCOMPLETE: "Profile Incomplete",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * Validates whether a transition from one DriverStatus to another is allowed.
 * Status rules:
 * - PENDING_REVIEW -> ACTIVE or REJECTED
 * - ACTIVE -> INACTIVE or SUSPENDED
 * - INACTIVE -> ACTIVE or SUSPENDED
 * - SUSPENDED -> ACTIVE or INACTIVE
 * - REJECTED -> PENDING_REVIEW (re-review)
 */
export function isValidStatusTransition(from: DriverStatus, to: DriverStatus): boolean {
  if (from === to) return true;

  switch (from) {
    case "PENDING_REVIEW":
      return to === "ACTIVE" || to === "REJECTED";
    case "ACTIVE":
      return to === "INACTIVE" || to === "SUSPENDED";
    case "INACTIVE":
      return to === "ACTIVE" || to === "SUSPENDED";
    case "SUSPENDED":
      return to === "ACTIVE" || to === "INACTIVE";
    case "REJECTED":
      return to === "PENDING_REVIEW";
    default:
      return false;
  }
}

/**
 * Validates whether a driver is allowed to be set to a specific availability.
 * Rules:
 * - Non-active drivers cannot be AVAILABLE.
 * - Active drivers can toggle between AVAILABLE, UNAVAILABLE, OFFLINE.
 * - ON_DELIVERY is reserved for dispatch assignment (Phase 2.5+).
 */
export function canDriverBeAvailable(status: DriverStatus): boolean {
  return status === "ACTIVE";
}
