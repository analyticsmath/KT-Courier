import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type OperationalStatusPresentation = {
  label: string;
  description: string;
  tone: ProtectedStatusTone;
  terminal: boolean;
  actionRequired: boolean;
};

const ORDER_STATUSES: Readonly<Record<string, OperationalStatusPresentation>> = {
  PENDING: { label: "Awaiting confirmation", description: "The request is waiting for its next canonical review step.", tone: "warning", terminal: false, actionRequired: true },
  CONFIRMED: { label: "Confirmed", description: "The order is ready for dispatch when assignment eligibility permits.", tone: "information", terminal: false, actionRequired: false },
  PICKUP_SCHEDULED: { label: "Pickup scheduled", description: "A pickup operation has been scheduled.", tone: "information", terminal: false, actionRequired: false },
  PICKED_UP: { label: "Picked up", description: "Custody was recorded by the operational workflow.", tone: "information", terminal: false, actionRequired: false },
  IN_PROGRESS: { label: "In progress", description: "The order is under active operational handling.", tone: "information", terminal: false, actionRequired: false },
  IN_TRANSIT: { label: "In transit", description: "The order is moving through the delivery workflow.", tone: "information", terminal: false, actionRequired: false },
  DELIVERY_ATTEMPTED: { label: "Delivery attempted", description: "A delivery attempt was recorded and needs operational review.", tone: "warning", terminal: false, actionRequired: true },
  DELIVERED: { label: "Delivered", description: "Delivery was recorded by the canonical workflow.", tone: "success", terminal: true, actionRequired: false },
  COMPLETED: { label: "Completed", description: "The order reached its completed terminal state.", tone: "success", terminal: true, actionRequired: false },
  CANCELLED: { label: "Cancelled", description: "The order was cancelled by an authorised lifecycle action.", tone: "neutral", terminal: true, actionRequired: false },
  FAILED: { label: "Failed", description: "The current workflow recorded a failure that needs review.", tone: "danger", terminal: true, actionRequired: true },
};

const ASSIGNMENT_STATUSES: Readonly<Record<string, OperationalStatusPresentation>> = {
  ASSIGNED: { label: "Awaiting driver response", description: "The assignment has been offered and is awaiting the driver workflow.", tone: "warning", terminal: false, actionRequired: true },
  ACCEPTED: { label: "Accepted", description: "The driver accepted the assignment.", tone: "information", terminal: false, actionRequired: false },
  REJECTED: { label: "Rejected", description: "The offered assignment was rejected and may require dispatch review.", tone: "warning", terminal: true, actionRequired: true },
  CANCELLED: { label: "Cancelled", description: "The assignment was cancelled by a canonical operational action.", tone: "neutral", terminal: true, actionRequired: false },
  COMPLETED: { label: "Completed", description: "The assignment reached its recorded completion state.", tone: "success", terminal: true, actionRequired: false },
};

const FALLBACK: OperationalStatusPresentation = {
  label: "Status unavailable",
  description: "This source state is not mapped for administration yet.",
  tone: "neutral",
  terminal: false,
  actionRequired: false,
};

export function presentOrderStatus(status: string): OperationalStatusPresentation {
  return ORDER_STATUSES[status] ?? FALLBACK;
}

export function presentAssignmentStatus(status: string): OperationalStatusPresentation {
  return ASSIGNMENT_STATUSES[status] ?? FALLBACK;
}

export function presentBooleanState(value: boolean, labels: { enabled: string; disabled: string }): OperationalStatusPresentation {
  return value
    ? { label: labels.enabled, description: "The recorded configuration is active.", tone: "success", terminal: false, actionRequired: false }
    : { label: labels.disabled, description: "The recorded configuration is not active.", tone: "neutral", terminal: false, actionRequired: false };
}
