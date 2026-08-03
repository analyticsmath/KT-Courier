import {
  OrderStatus,
  OrderAssignmentEventType,
  DeliveryExceptionReason,
  ProofOfDeliveryMethod,
} from "@/types/db";

// ─── Delivery OTP configuration ───────────────────────────────────────────────
// 30-minute expiry is long enough for difficult delivery situations.
// 5 max attempts prevent brute-force without locking out legitimate recipients.
// Resend is rate-limited separately via DELIVERY_OTP_SEND rate limit config.

export const DELIVERY_OTP_EXPIRY_MINUTES = 30;
export const DELIVERY_OTP_MAX_ATTEMPTS = 5;

// ─── Order statuses where delivery actions are allowed ────────────────────────

export const DELIVERY_ELIGIBLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
];

export const DELIVERY_ATTEMPTED_ELIGIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERY_ATTEMPTED,
];

export function isDeliveryEligible(status: OrderStatus): boolean {
  return DELIVERY_ELIGIBLE_ORDER_STATUSES.includes(status);
}

export function isDeliveryAttemptEligible(status: OrderStatus): boolean {
  return DELIVERY_ATTEMPTED_ELIGIBLE_STATUSES.includes(status);
}

// Terminal statuses that block all delivery actions
export const DELIVERY_BLOCKED_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PICKUP_SCHEDULED,
];

export function isDeliveryBlocked(status: OrderStatus): boolean {
  return DELIVERY_BLOCKED_STATUSES.includes(status);
}

// ─── Assignment event labels for delivery ─────────────────────────────────────

export const DELIVERY_ASSIGNMENT_EVENT_LABELS: Partial<Record<OrderAssignmentEventType, string>> = {
  DELIVERY_STARTED: "Delivery started",
  DELIVERY_OTP_SENT: "OTP sent to recipient",
  DELIVERY_OTP_VERIFIED: "OTP verified",
  DELIVERY_COMPLETED: "Delivery completed",
  DELIVERY_ATTEMPTED: "Delivery attempted",
  DELIVERY_FAILED: "Delivery failed",
};

// ─── Delivery exception reason labels ─────────────────────────────────────────

export const DELIVERY_EXCEPTION_REASON_LABELS: Record<DeliveryExceptionReason, string> = {
  RECIPIENT_UNAVAILABLE: "Recipient unavailable",
  WRONG_ADDRESS: "Wrong or incorrect address",
  ACCESS_ISSUE: "Access issue at address",
  RECIPIENT_REFUSED: "Recipient refused delivery",
  SAFETY_ISSUE: "Safety concern at location",
  PARCEL_DAMAGED: "Parcel damage noted",
  PAYMENT_OR_DOCUMENT_ISSUE: "Payment or document required",
  OTHER: "Other reason",
};

// Reasons that require a mandatory note from the driver
export const DELIVERY_EXCEPTION_REASONS_REQUIRING_NOTE: DeliveryExceptionReason[] = [
  DeliveryExceptionReason.SAFETY_ISSUE,
  DeliveryExceptionReason.RECIPIENT_REFUSED,
  DeliveryExceptionReason.OTHER,
];

export function doesDeliveryExceptionRequireNote(reason: DeliveryExceptionReason): boolean {
  return DELIVERY_EXCEPTION_REASONS_REQUIRING_NOTE.includes(reason);
}

// ─── Proof of Delivery method labels ──────────────────────────────────────────

export const POD_METHOD_LABELS: Record<ProofOfDeliveryMethod, string> = {
  OTP: "OTP verified",
  ADMIN_MANUAL: "Manually confirmed by KT Couriers",
  PHOTO_FUTURE: "Photo proof (future)",
  SIGNATURE_FUTURE: "Signature (future)",
};

// Customer/store-safe POD method descriptions
export const POD_METHOD_PUBLIC_LABELS: Record<ProofOfDeliveryMethod, string> = {
  OTP: "Delivery confirmed with one-time code",
  ADMIN_MANUAL: "Delivery confirmed by KT Couriers",
  PHOTO_FUTURE: "Photo proof recorded",
  SIGNATURE_FUTURE: "Signature recorded",
};
