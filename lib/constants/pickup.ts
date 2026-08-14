import {
  OrderStatus,
  OrderOperationalEventType,
  PickupFailureReason,
  ParcelCondition,
} from "@/types/db";

// ─── Order statuses where a driver can initiate or complete pickup ─────────────

export const PICKUP_ELIGIBLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PICKUP_SCHEDULED,
];

export function isPickupEligible(status: OrderStatus): boolean {
  return PICKUP_ELIGIBLE_ORDER_STATUSES.includes(status);
}

// ─── Terminal statuses that block all pickup actions ──────────────────────────

export const PICKUP_BLOCKED_STATUSES: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.IN_PROGRESS,
  OrderStatus.DELIVERY_ATTEMPTED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
];

export function isPickupBlocked(status: OrderStatus): boolean {
  return PICKUP_BLOCKED_STATUSES.includes(status);
}

// ─── Operational event display labels ─────────────────────────────────────────

export const OPERATIONAL_EVENT_LABELS: Record<OrderOperationalEventType, string> = {
  PICKUP_STARTED: "Pickup started",
  PICKUP_COMPLETED: "Pickup completed",
  PICKUP_FAILED: "Pickup could not be completed",
  PARCEL_CONDITION_RECORDED: "Parcel condition recorded",
  DRIVER_NOTE_ADDED: "Driver note added",
  ADMIN_OPERATION_NOTE_ADDED: "Operations note added",
  DELIVERY_STARTED: "Delivery started",
  DELIVERY_OTP_GENERATED: "Delivery OTP generated",
  DELIVERY_OTP_VERIFIED: "Delivery OTP verified",
  DELIVERY_COMPLETED: "Delivery completed",
  DELIVERY_ATTEMPTED: "Delivery attempted",
  DELIVERY_FAILED: "Delivery could not be completed",
  POD_CREATED: "Proof of delivery created",
  ADMIN_DELIVERY_OVERRIDE: "Delivery manually confirmed by admin",
  ASSIGNMENT_OFFERED: "Driver offer created",
  ASSIGNMENT_ACCEPTED: "Driver offer accepted",
  ASSIGNMENT_REJECTED: "Driver offer rejected",
  ASSIGNMENT_EXPIRED: "Driver offer expired",
  ASSIGNMENT_REVOKED: "Driver assignment revoked",
  ASSIGNMENT_SUPERSEDED: "Driver assignment superseded",
  ASSIGNMENT_COMPLETED: "Driver assignment completed",
  VENDOR_PACKAGING_CONFIRMED: "Vendor packaging confirmed",
  VENDOR_LAWFUL_LISTING_CONFIRMED: "Vendor lawful listing confirmed",
  VENDOR_HANDOFF_READY: "Vendor handoff ready",
  DRIVER_SAFETY_CONFIRMED: "Driver safety confirmed",
  DRIVER_LAWFUL_TRANSPORT_CONFIRMED: "Driver lawful transport confirmed",
  DRIVER_SUSPICIOUS_PACKAGE_REPORTED: "Suspicious package reported by driver",
};

// ─── Customer-safe operational event labels ───────────────────────────────────

export const CUSTOMER_OPERATIONAL_EVENT_LABELS: Record<OrderOperationalEventType, string> = {
  PICKUP_STARTED: "Pickup is in progress.",
  PICKUP_COMPLETED: "Your parcel has been collected.",
  PICKUP_FAILED: "Pickup could not be completed. KT Couriers will review the request.",
  PARCEL_CONDITION_RECORDED: "Parcel condition has been recorded.",
  DRIVER_NOTE_ADDED: "A note has been added to your delivery.",
  ADMIN_OPERATION_NOTE_ADDED: "An update has been added to your delivery.",
  DELIVERY_STARTED: "Your delivery is on its way.",
  DELIVERY_OTP_GENERATED: "A delivery confirmation code has been sent.",
  DELIVERY_OTP_VERIFIED: "Delivery confirmation verified.",
  DELIVERY_COMPLETED: "Your parcel has been delivered.",
  DELIVERY_ATTEMPTED: "Delivery was attempted. Please arrange a redelivery with KT Couriers.",
  DELIVERY_FAILED: "Delivery could not be completed. KT Couriers will be in contact.",
  POD_CREATED: "Proof of delivery has been recorded.",
  ADMIN_DELIVERY_OVERRIDE: "Delivery has been confirmed by KT Couriers.",
  ASSIGNMENT_OFFERED: "A driver is being assigned.",
  ASSIGNMENT_ACCEPTED: "A driver is preparing for pickup.",
  ASSIGNMENT_REJECTED: "KT Couriers will arrange another driver.",
  ASSIGNMENT_EXPIRED: "KT Couriers will arrange another driver.",
  ASSIGNMENT_REVOKED: "Driver assignment changed.",
  ASSIGNMENT_SUPERSEDED: "Driver assignment changed.",
  ASSIGNMENT_COMPLETED: "Delivery assignment completed.",
  VENDOR_PACKAGING_CONFIRMED: "Parcel packaging has been confirmed.",
  VENDOR_LAWFUL_LISTING_CONFIRMED: "The order listing has been verified.",
  VENDOR_HANDOFF_READY: "The vendor is preparing the parcel for handoff.",
  DRIVER_SAFETY_CONFIRMED: "Driver safety checks are complete.",
  DRIVER_LAWFUL_TRANSPORT_CONFIRMED: "Transport compliance has been confirmed.",
  DRIVER_SUSPICIOUS_PACKAGE_REPORTED: "A delivery safety review is in progress.",
};

// ─── Pickup failure reason display labels ─────────────────────────────────────

export const PICKUP_FAILURE_REASON_LABELS: Record<PickupFailureReason, string> = {
  PARCEL_NOT_READY: "Parcel not ready",
  SENDER_UNAVAILABLE: "Sender unavailable",
  PICKUP_ADDRESS_ISSUE: "Pickup address issue",
  ACCESS_ISSUE: "Access issue",
  ORDER_CANCELLED_AT_PICKUP: "Order cancelled at pickup",
  SAFETY_ISSUE: "Safety issue",
  OTHER: "Other",
};

// ─── Parcel condition display labels ──────────────────────────────────────────

export const PARCEL_CONDITION_LABELS: Record<ParcelCondition, string> = {
  NOT_RECORDED: "Not recorded",
  GOOD: "Good condition",
  DAMAGED_PACKAGING: "Damaged packaging",
  FRAGILE: "Fragile",
  INCOMPLETE: "Incomplete",
  REQUIRES_ADMIN_REVIEW: "Requires admin review",
};

// ─── Pickup failure reasons that require a note ───────────────────────────────

export const FAILURE_REASONS_REQUIRING_NOTE: PickupFailureReason[] = [
  PickupFailureReason.OTHER,
  PickupFailureReason.SAFETY_ISSUE,
];

export function doesFailureReasonRequireNote(reason: PickupFailureReason): boolean {
  return FAILURE_REASONS_REQUIRING_NOTE.includes(reason);
}
