/**
 * Frontend-facing order types — aligned with Phase 1 Prisma DB enums.
 * Use uppercase values that match the Prisma-generated OrderStatus enum.
 */

// Phase 2.2 lifecycle statuses (matches Prisma OrderStatus enum)
export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "IN_PROGRESS"
  | "DELIVERY_ATTEMPTED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type PaymentStatus = "paid" | "unpaid" | "refunded";

// Matches Prisma DeliveryType enum
export type DeliveryType =
  | "SAME_DAY"
  | "SCHEDULED"
  | "BUSINESS"
  | "PARCEL_DOCUMENT";

export interface Address {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  postcode?: string;
  notes?: string;
}

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  timestamp: string;
  completed: boolean;
  current?: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryType: DeliveryType;
  pickup: Address;
  dropoff: Address;
  parcelDescription?: string;
  scheduledDate?: string;
  estimatedDelivery?: string;
  createdAt: string;
  updatedAt: string;
  driverName?: string;
  timeline: TimelineEvent[];
  notes?: string;
  storeId?: string;
  customerId?: string;
}
