import type { OrderStatus } from "@/types/order";
import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type CustomerOrderStatusPresentation = Readonly<{
  label: string;
  description: string;
  tone: ProtectedStatusTone;
}>;

/**
 * Customer-safe labels are deliberately explicit. Unknown server values are
 * never inferred as a successful delivery state.
 */
const CUSTOMER_ORDER_STATUSES: Readonly<Record<OrderStatus, CustomerOrderStatusPresentation>> = {
  DRAFT: { label: "Draft", description: "Your delivery request is being prepared.", tone: "neutral" },
  PENDING: { label: "Request received", description: "Your delivery request has been received.", tone: "warning" },
  CONFIRMED: { label: "Confirmed", description: "KT Couriers has confirmed your delivery request.", tone: "information" },
  PICKUP_SCHEDULED: { label: "Pickup scheduled", description: "Pickup has been scheduled.", tone: "information" },
  PICKED_UP: { label: "Picked up", description: "Your parcel has been collected.", tone: "information" },
  IN_TRANSIT: { label: "In transit", description: "Your parcel is moving toward the drop-off address.", tone: "information" },
  IN_PROGRESS: { label: "In progress", description: "Your parcel is in progress.", tone: "information" },
  DELIVERY_ATTEMPTED: { label: "Delivery attempted", description: "A delivery attempt was recorded.", tone: "warning" },
  DELIVERED: { label: "Delivered", description: "Delivery completed.", tone: "success" },
  COMPLETED: { label: "Completed", description: "Delivery completed.", tone: "success" },
  CANCELLED: { label: "Cancelled", description: "This delivery was cancelled.", tone: "neutral" },
  FAILED: { label: "Could not be completed", description: "This delivery could not be completed.", tone: "danger" },
};

export const CUSTOMER_ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PICKUP_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "IN_PROGRESS",
  "DELIVERY_ATTEMPTED",
];

export function getCustomerOrderStatus(status: string): CustomerOrderStatusPresentation {
  return CUSTOMER_ORDER_STATUSES[status as OrderStatus] ?? {
    label: "Status update unavailable",
    description: "The latest delivery status cannot be shown safely right now.",
    tone: "neutral",
  };
}

export function formatCustomerDateTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Formats server-issued decimal text without performing monetary arithmetic. */
export function formatCustomerMoney(amount: string, currency: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return `${currency} —`;
  const [, sign, whole, fraction = "00"] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${sign}${grouped}.${fraction.padEnd(2, "0")}`;
}

export function getCustomerRefundStatus(status: string): Readonly<{ label: string; tone: ProtectedStatusTone }> {
  const statuses: Readonly<Record<string, Readonly<{ label: string; tone: ProtectedStatusTone }>>> = {
    REQUESTED: { label: "Requested", tone: "warning" },
    UNDER_REVIEW: { label: "Under review", tone: "warning" },
    APPROVED: { label: "Approved", tone: "information" },
    PROCESSING: { label: "Processing", tone: "information" },
    SUCCEEDED: { label: "Completed", tone: "success" },
    REJECTED: { label: "Not approved", tone: "danger" },
    CANCELLED: { label: "Cancelled", tone: "neutral" },
    RECONCILIATION_REQUIRED: { label: "Update required", tone: "warning" },
  };
  return statuses[status] ?? { label: "Status update unavailable", tone: "neutral" };
}

export function getCustomerRefundReason(reason: string): string {
  const reasons: Readonly<Record<string, string>> = {
    ORDER_CANCELLED: "Order cancelled",
    SERVICE_NOT_PROVIDED: "Service not provided",
    DUPLICATE_PAYMENT: "Duplicate payment",
    OVERPAYMENT: "Overpayment",
    SERVICE_FAILURE: "Service failure",
    CUSTOMER_SERVICE_RESOLUTION: "Customer service resolution",
    OTHER_REVIEWED: "Other reviewed reason",
  };
  return reasons[reason] ?? "Reason unavailable";
}

export function getCustomerWithdrawalStatus(status: string): Readonly<{ label: string; tone: ProtectedStatusTone }> {
  const statuses: Readonly<Record<string, Readonly<{ label: string; tone: ProtectedStatusTone }>>> = {
    REQUESTED: { label: "Requested", tone: "warning" },
    UNDER_REVIEW: { label: "Under review", tone: "warning" },
    APPROVED: { label: "Approved", tone: "information" },
    PROCESSING: { label: "Processing", tone: "information" },
    PAID: { label: "Paid", tone: "success" },
    REJECTED: { label: "Not approved", tone: "danger" },
    CANCELLED: { label: "Cancelled", tone: "neutral" },
    RECONCILIATION_REQUIRED: { label: "Update required", tone: "warning" },
  };
  return statuses[status] ?? { label: "Status update unavailable", tone: "neutral" };
}
