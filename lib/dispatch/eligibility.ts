export type DispatchEligibilityReason =
  | "DRIVER_USER_INACTIVE" | "DRIVER_PROFILE_INACTIVE" | "DRIVER_UNAVAILABLE"
  | "DRIVER_REGION_MISMATCH" | "DRIVER_CAPACITY_REACHED" | "ORDER_ALREADY_ASSIGNED" | "DRIVER_COMPLIANCE_INCOMPLETE";

export function evaluateDriverEligibility(input: { userActive: boolean; profileActive: boolean; available: boolean; regionMatch: boolean; activeLoad: number; capacity: number; orderAlreadyAssigned?: boolean; complianceEligible?: boolean }) {
  const reasons: DispatchEligibilityReason[] = [];
  if (!input.userActive) reasons.push("DRIVER_USER_INACTIVE");
  if (!input.profileActive) reasons.push("DRIVER_PROFILE_INACTIVE");
  if (!input.available) reasons.push("DRIVER_UNAVAILABLE");
  if (!input.regionMatch) reasons.push("DRIVER_REGION_MISMATCH");
  if (input.activeLoad >= input.capacity) reasons.push("DRIVER_CAPACITY_REACHED");
  if (input.orderAlreadyAssigned) reasons.push("ORDER_ALREADY_ASSIGNED");
  if (input.complianceEligible === false) reasons.push("DRIVER_COMPLIANCE_INCOMPLETE");
  return { eligible: reasons.length === 0, reasons, activeLoad: input.activeLoad, capacity: input.capacity };
}
