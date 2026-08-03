/**
 * Application-layer domain types.
 *
 * These are shaped for use in server actions, API route handlers, and
 * component props — they are NOT raw Prisma model types. They may combine
 * fields from multiple models, omit internal fields, or add computed fields.
 *
 * Prisma model types are in types/db.ts.
 * Frontend display types (OrderStatus union strings) remain in types/order.ts
 * for use with mock data and badge components.
 */

import type { UserRole, UserStatus, OrderStatus, DeliveryType, StoreStatus } from "./db";

// ─── User domain ─────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
}

// ─── Order domain ─────────────────────────────────────────────────────────────

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  recipientName: string | null;
  parcelDescription: string | null;
  priceEstimate: number | null;
  createdAt: Date;
  scheduledFor: Date | null;
  customerName?: string | null;
  storeName?: string | null;
  pickupCity?: string | null;
  dropoffCity?: string | null;
}

// ─── Store domain ─────────────────────────────────────────────────────────────

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  contactName: string | null;
  contactEmail: string | null;
  city: string | null;
}

// ─── Pricing domain ───────────────────────────────────────────────────────────

export interface PricingBreakdown {
  ruleId: string;
  ruleName: string;
  amount: number;
  currency: string;
  note?: string;
}

export interface PriceEstimateResult {
  total: number;
  currency: string;
  breakdown: PricingBreakdown[];
}

// ─── Payment provider domain ─────────────────────────────────────────────────

export type PaymentProviderEnvironmentValue = "SANDBOX" | "PRODUCTION";
export type PaymentCustomerActionTypeValue = "FORM_POST" | "REDIRECT_GET";

// ─── Contact domain ───────────────────────────────────────────────────────────

export interface ContactFormPayload {
  name: string;
  email: string;
  phone?: string;
  enquiryType: string;
  message: string;
}

// ─── System settings domain ───────────────────────────────────────────────────

export type SettingValue = string | number | boolean | Record<string, unknown>;

export interface ParsedSystemSetting {
  key: string;
  label: string;
  value: SettingValue;
  description: string | null;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
