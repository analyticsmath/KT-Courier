import type { OrderStatus } from "@/types/order";

// ─── Customer-facing status copy ──────────────────────────────────────────────
// These are the friendly messages shown to customers and store users.
// Admin-facing labels live in lib/constants/statuses.ts.

export const CUSTOMER_STATUS_COPY: Record<OrderStatus, string> = {
  DRAFT: "Your delivery request is being prepared.",
  PENDING: "Your delivery request has been received.",
  CONFIRMED: "KT Couriers has confirmed your delivery request.",
  PICKUP_SCHEDULED: "Pickup has been scheduled.",
  PICKED_UP: "Your parcel has been collected.",
  IN_TRANSIT: "Your parcel is moving toward the drop off address.",
  IN_PROGRESS: "Your parcel is in progress.",
  DELIVERY_ATTEMPTED: "A delivery attempt was recorded.",
  DELIVERED: "Delivery completed.",
  COMPLETED: "Delivery completed.",
  CANCELLED: "This delivery was cancelled.",
  FAILED: "This delivery could not be completed.",
};

// ─── Statuses where customer/store may request cancellation ──────────────────
// Only before any pickup activity has started.

export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
];

// ─── Statuses that trigger email notifications to customer/store ──────────────

export const NOTIFY_STATUS_CHANGES: OrderStatus[] = [
  "CONFIRMED",
  "PICKUP_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERY_ATTEMPTED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
];

// ─── Terminal statuses — no further transitions allowed ───────────────────────

export const TERMINAL_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
];

// ─── Statuses visible on admin operational queue ─────────────────────────────
// Ordered for display (active first, terminal last)

export const ADMIN_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PICKUP_SCHEDULED", label: "Pickup scheduled" },
  { value: "PICKED_UP", label: "Picked up" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DELIVERY_ATTEMPTED", label: "Delivery attempted" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed legacy" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
];
