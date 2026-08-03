import type { OrderStatus, PaymentStatus } from "@/types/order";
import type { BadgeVariant } from "@/types/ui";
import type { UserStatus, StoreStatus } from "@/types/db";

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  DRAFT: { label: "Draft", variant: "slate" },
  PENDING: { label: "Requested", variant: "amber" },
  CONFIRMED: { label: "Confirmed", variant: "blue" },
  PICKUP_SCHEDULED: { label: "Pickup scheduled", variant: "blue" },
  PICKED_UP: { label: "Picked up", variant: "cyan" },
  IN_TRANSIT: { label: "In transit", variant: "cyan" },
  IN_PROGRESS: { label: "In progress", variant: "cyan" },
  DELIVERY_ATTEMPTED: { label: "Delivery attempted", variant: "amber" },
  DELIVERED: { label: "Delivered", variant: "green" },
  COMPLETED: { label: "Completed legacy", variant: "green" },
  CANCELLED: { label: "Cancelled", variant: "gray" },
  FAILED: { label: "Failed", variant: "red" },
};

export const DELIVERY_TYPE_CONFIG: Record<string, StatusConfig> = {
  SAME_DAY: { label: "Same-day", variant: "blue" },
  SCHEDULED: { label: "Scheduled", variant: "amber" },
  BUSINESS: { label: "Business", variant: "purple" },
  PARCEL_DOCUMENT: { label: "Parcel / Document", variant: "slate" },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, StatusConfig> = {
  paid: { label: "Paid", variant: "green" },
  unpaid: { label: "Unpaid", variant: "amber" },
  refunded: { label: "Refunded", variant: "gray" },
};

export function getOrderStatusConfig(status: OrderStatus): StatusConfig {
  return ORDER_STATUS_CONFIG[status] ?? { label: status, variant: "slate" };
}

export function getDeliveryTypeConfig(type: string): StatusConfig {
  return DELIVERY_TYPE_CONFIG[type] ?? { label: type, variant: "slate" };
}

export function getPaymentStatusConfig(status: PaymentStatus): StatusConfig {
  return PAYMENT_STATUS_CONFIG[status] ?? { label: status, variant: "slate" };
}

export const USER_STATUS_CONFIG: Record<UserStatus, StatusConfig> = {
  PENDING_VERIFICATION: { label: "Pending verification", variant: "amber" },
  ACTIVE: { label: "Active", variant: "green" },
  SUSPENDED: { label: "Suspended", variant: "red" },
  DISABLED: { label: "Disabled", variant: "gray" },
};

export const STORE_STATUS_CONFIG: Record<StoreStatus, StatusConfig> = {
  PENDING: { label: "Pending approval", variant: "amber" },
  ACTIVE: { label: "Active", variant: "green" },
  SUSPENDED: { label: "Suspended", variant: "red" },
  DISABLED: { label: "Disabled", variant: "gray" },
};

export function getUserStatusConfig(status: UserStatus): StatusConfig {
  return USER_STATUS_CONFIG[status] ?? { label: status, variant: "slate" };
}

export function getStoreStatusConfig(status: StoreStatus): StatusConfig {
  return STORE_STATUS_CONFIG[status] ?? { label: status, variant: "slate" };
}
