import { OrderAssignmentStatus, OrderAssignmentEventType, OrderStatus, DriverStatus, DriverAvailability } from "@/types/db";

// ─── Assignment status display labels ────────────────────────────────────────

export const ASSIGNMENT_STATUS_LABELS: Record<OrderAssignmentStatus, string> = {
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Offer expired",
  REVOKED: "Revoked",
  SUPERSEDED: "Superseded",
};

export const ASSIGNMENT_STATUS_CUSTOMER_LABELS: Record<OrderAssignmentStatus, string> = {
  ASSIGNED: "Driver assigned",
  ACCEPTED: "Driver preparing for pickup",
  REJECTED: "KT Couriers will reassign",
  CANCELLED: "Driver assignment cancelled",
  COMPLETED: "Delivery completed",
  EXPIRED: "Driver offer expired",
  REVOKED: "Driver assignment revoked",
  SUPERSEDED: "Driver assignment replaced",
};

// ─── Active vs terminal ───────────────────────────────────────────────────────

export const ACTIVE_ASSIGNMENT_STATUSES: OrderAssignmentStatus[] = [
  OrderAssignmentStatus.ASSIGNED,
  OrderAssignmentStatus.ACCEPTED,
];

export const TERMINAL_ASSIGNMENT_STATUSES: OrderAssignmentStatus[] = [
  OrderAssignmentStatus.REJECTED,
  OrderAssignmentStatus.CANCELLED,
  OrderAssignmentStatus.COMPLETED,
  OrderAssignmentStatus.EXPIRED,
  OrderAssignmentStatus.REVOKED,
  OrderAssignmentStatus.SUPERSEDED,
];

export function isActiveAssignment(status: OrderAssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.includes(status);
}

export function isTerminalAssignment(status: OrderAssignmentStatus): boolean {
  return TERMINAL_ASSIGNMENT_STATUSES.includes(status);
}

// ─── Order statuses eligible for assignment ───────────────────────────────────
// Only CONFIRMED and PICKUP_SCHEDULED are assignable in Phase 2.5.

export const ASSIGNABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PICKUP_SCHEDULED,
];

export function isOrderAssignable(status: OrderStatus): boolean {
  return ASSIGNABLE_ORDER_STATUSES.includes(status);
}

// ─── Driver statuses eligible for assignment ──────────────────────────────────

export const ELIGIBLE_DRIVER_STATUSES: DriverStatus[] = [
  DriverStatus.ACTIVE,
];

export const ELIGIBLE_DRIVER_AVAILABILITIES: DriverAvailability[] = [
  DriverAvailability.AVAILABLE,
];

export const OVERRIDE_ALLOWED_AVAILABILITIES: DriverAvailability[] = [
  DriverAvailability.UNAVAILABLE,
];

export function isDriverEligible(status: DriverStatus): boolean {
  return ELIGIBLE_DRIVER_STATUSES.includes(status);
}

// ─── Assignment transition rules ──────────────────────────────────────────────
// Maps current status → allowed next statuses.

export const ASSIGNMENT_TRANSITIONS: Record<OrderAssignmentStatus, OrderAssignmentStatus[]> = {
  [OrderAssignmentStatus.ASSIGNED]: [
    OrderAssignmentStatus.ACCEPTED,
    OrderAssignmentStatus.REJECTED,
    OrderAssignmentStatus.CANCELLED,
  ],
  [OrderAssignmentStatus.ACCEPTED]: [
    OrderAssignmentStatus.CANCELLED,
    OrderAssignmentStatus.COMPLETED,
  ],
  [OrderAssignmentStatus.REJECTED]: [],
  [OrderAssignmentStatus.CANCELLED]: [],
  [OrderAssignmentStatus.COMPLETED]: [],
  [OrderAssignmentStatus.EXPIRED]: [],
  [OrderAssignmentStatus.REVOKED]: [],
  [OrderAssignmentStatus.SUPERSEDED]: [],
};

export function isValidAssignmentTransition(
  from: OrderAssignmentStatus,
  to: OrderAssignmentStatus
): boolean {
  return ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Event type labels ────────────────────────────────────────────────────────

export const ASSIGNMENT_EVENT_LABELS: Record<OrderAssignmentEventType, string> = {
  ASSIGNMENT_CREATED: "Assignment created",
  ASSIGNMENT_ACCEPTED: "Driver accepted",
  ASSIGNMENT_REJECTED: "Driver rejected",
  ASSIGNMENT_CANCELLED: "Assignment cancelled",
  ASSIGNMENT_REASSIGNED: "Order reassigned",
  ASSIGNMENT_COMPLETED: "Assignment completed",
  ASSIGNMENT_NOTE_ADDED: "Note added",
  PICKUP_STARTED: "Pickup started",
  PICKUP_COMPLETED: "Pickup completed",
  PICKUP_FAILED: "Pickup failed",
  DELIVERY_STARTED: "Delivery started",
  DELIVERY_OTP_SENT: "OTP sent to recipient",
  DELIVERY_OTP_VERIFIED: "OTP verified",
  DELIVERY_COMPLETED: "Delivery completed",
  DELIVERY_ATTEMPTED: "Delivery attempted",
  DELIVERY_FAILED: "Delivery failed",
  ASSIGNMENT_EXPIRED: "Offer expired",
  ASSIGNMENT_REVOKED: "Assignment revoked",
  ASSIGNMENT_SUPERSEDED: "Assignment superseded",
};
