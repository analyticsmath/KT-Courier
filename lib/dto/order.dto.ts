import type {
  Order,
  Address,
  OrderStatusHistory,
  User,
  Store,
  PricingRule,
  DeliveryRegion,
} from "@/types/db";
import type { OrderStatus, OrderSource, DeliveryType, AddressType, PricingRuleType } from "@/types/db";

// ─── Address ──────────────────────────────────────────────────────────────────

export interface AddressDto {
  id: string;
  type: AddressType;
  contactName: string | null;
  contactPhone: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  accessNotes: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

export function toAddressDto(address: Address): AddressDto {
  return {
    id: address.id,
    type: address.type,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    accessNotes: address.accessNotes,
    formattedAddress: address.formattedAddress,
    latitude: address.latitude !== null ? Number(address.latitude) : null,
    longitude: address.longitude !== null ? Number(address.longitude) : null,
    placeId: address.placeId,
  };
}

export function addressSummary(address: Address | null): string {
  if (!address) return "—";
  const parts = [address.line1, address.city].filter(Boolean);
  return parts.join(", ") || address.line1;
}

// ─── Status history (public — customer/store safe) ────────────────────────────
// Never include internalNote or actorName in this DTO.

export interface OrderStatusHistoryDto {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: Date;
}

export function toOrderStatusHistoryDto(
  history: OrderStatusHistory & { actorUser?: User | null }
): OrderStatusHistoryDto {
  return {
    id: history.id,
    status: history.status,
    note: history.note,
    createdAt: history.createdAt,
  };
}

// ─── Status history (admin — includes internal note + actor) ─────────────────

export interface AdminOrderStatusHistoryDto {
  id: string;
  status: OrderStatus;
  note: string | null;
  internalNote: string | null;
  actorName: string | null;
  createdAt: Date;
}

export function toAdminOrderStatusHistoryDto(
  history: OrderStatusHistory & { actorUser?: User | null }
): AdminOrderStatusHistoryDto {
  return {
    id: history.id,
    status: history.status,
    note: history.note,
    internalNote: (history as unknown as { internalNote?: string | null }).internalNote ?? null,
    actorName: history.actorUser?.name ?? null,
    createdAt: history.createdAt,
  };
}

// ─── Order summary (list view) ────────────────────────────────────────────────

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  source: OrderSource;
  status: OrderStatus;
  deliveryType: DeliveryType;
  currency: string;
  recipientName: string | null;
  recipientPhone: string | null;
  parcelDescription: string | null;
  parcelCount: number;
  priceEstimate: number | null;
  scheduledFor: Date | null;
  pickupSummary: string;
  dropoffSummary: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  pickupContactName: string | null;
  dropoffContactName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  storeName: string | null;
  // Phase 2.1 route snapshot
  distanceMeters: number | null;
  durationSeconds: number | null;
  routeSummary: string | null;
  routeProvider: string | null;
  routeCalculatedAt: Date | null;
  deliveryRegionId: string | null;
  deliveryRegionName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type OrderWithAddresses = Order & {
  pickupAddress?: Address | null;
  dropoffAddress?: Address | null;
  deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
  customer?: Pick<User, "name" | "email"> | null;
  store?: Pick<Store, "name"> | null;
};

export function toOrderSummaryDto(order: OrderWithAddresses): OrderSummaryDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    status: order.status,
    deliveryType: order.deliveryType,
    currency: order.currency,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    parcelDescription: order.parcelDescription,
    parcelCount: order.parcelCount,
    priceEstimate: order.priceEstimate !== null ? Number(order.priceEstimate) : null,
    scheduledFor: order.scheduledFor,
    pickupSummary: addressSummary(order.pickupAddress ?? null),
    dropoffSummary: addressSummary(order.dropoffAddress ?? null),
    pickupCity: order.pickupAddress?.city ?? null,
    dropoffCity: order.dropoffAddress?.city ?? null,
    pickupContactName: order.pickupAddress?.contactName ?? null,
    dropoffContactName: order.dropoffAddress?.contactName ?? order.recipientName,
    customerName: order.customer?.name ?? null,
    customerEmail: order.customer?.email ?? null,
    storeName: order.store?.name ?? null,
    distanceMeters: order.distanceMeters ?? null,
    durationSeconds: order.durationSeconds ?? null,
    routeSummary: order.routeSummary ?? null,
    routeProvider: order.routeProvider ?? null,
    routeCalculatedAt: order.routeCalculatedAt ?? null,
    deliveryRegionId: order.deliveryRegionId ?? null,
    deliveryRegionName: order.deliveryRegion?.name ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// ─── Order detail (customer/store — public fields only) ───────────────────────

export interface OrderDetailDto extends OrderSummaryDto {
  pickupAddress: AddressDto | null;
  dropoffAddress: AddressDto | null;
  customerNote: string | null;
  adminNote: string | null;
  statusHistory: OrderStatusHistoryDto[];
  customer: { id: string; email: string; name: string | null } | null;
  store: { id: string; name: string; slug: string } | null;
}

type OrderWithFull = Order & {
  pickupAddress?: Address | null;
  dropoffAddress?: Address | null;
  deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
  statusHistory?: (OrderStatusHistory & { actorUser?: User | null })[];
  customer?: User | null;
  store?: Store | null;
};

export function toOrderDetailDto(order: OrderWithFull): OrderDetailDto {
  const summary = toOrderSummaryDto(order);
  return {
    ...summary,
    pickupAddress: order.pickupAddress ? toAddressDto(order.pickupAddress) : null,
    dropoffAddress: order.dropoffAddress ? toAddressDto(order.dropoffAddress) : null,
    customerNote: order.customerNote,
    adminNote: order.adminNote,
    // Public history: no internalNote, no actorName
    statusHistory: (order.statusHistory ?? []).map(toOrderStatusHistoryDto),
    customer: order.customer
      ? { id: order.customer.id, email: order.customer.email, name: order.customer.name }
      : null,
    store: order.store
      ? { id: order.store.id, name: order.store.name, slug: order.store.slug }
      : null,
  };
}

// ─── Admin order detail (includes internal notes + actor on history) ──────────

export interface AdminOrderDetailDto extends Omit<OrderDetailDto, "statusHistory"> {
  statusHistory: AdminOrderStatusHistoryDto[];
}

export function toAdminOrderDetailDto(order: OrderWithFull): AdminOrderDetailDto {
  const base = toOrderDetailDto(order);
  return {
    ...base,
    // Admin history: includes internalNote and actorName
    statusHistory: (order.statusHistory ?? []).map(toAdminOrderStatusHistoryDto),
  };
}

// ─── Pricing rule ─────────────────────────────────────────────────────────────

export interface PricingRuleDto {
  id: string;
  name: string;
  type: PricingRuleType;
  deliveryType: DeliveryType | null;
  amount: number;
  currency: string;
  description: string | null;
  active: boolean;
  regionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  baseFee: number;
  perKmRate: number;
  includedDistanceKm: number;
  distanceIncrementKm: number;
  minimumCharge: number | null;
  flatSurcharge: number | null;
  vehicleClass: import("@/types/db").VehicleType | null;
  vehicleSurcharge: number | null;
  includedWeightKg: number | null;
  perAdditionalKgRate: number | null;
  maximumWeightKg: number | null;
  weightIncrementKg: number | null;
  dimensionalPricingEnabled: boolean;
  volumetricDivisor: number | null;
  maxDistanceKm: number | null;
  allowGlobalFallback: boolean;
  priority: number;
  revision: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  archivedAt: Date | null;
}

export function toPricingRuleDto(rule: PricingRule): PricingRuleDto {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    deliveryType: rule.deliveryType,
    amount: Number(rule.amount),
    currency: rule.currency,
    description: rule.description,
    active: rule.active,
    regionId: rule.regionId,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    baseFee: Number(rule.baseFee),
    perKmRate: Number(rule.perKmRate),
    includedDistanceKm: Number(rule.includedDistanceKm),
    distanceIncrementKm: Number(rule.distanceIncrementKm),
    minimumCharge: rule.minimumCharge === null ? null : Number(rule.minimumCharge),
    flatSurcharge: rule.flatSurcharge === null ? null : Number(rule.flatSurcharge),
    vehicleClass: rule.vehicleClass,
    vehicleSurcharge: rule.vehicleSurcharge === null ? null : Number(rule.vehicleSurcharge),
    includedWeightKg: rule.includedWeightKg === null ? null : Number(rule.includedWeightKg),
    perAdditionalKgRate: rule.perAdditionalKgRate === null ? null : Number(rule.perAdditionalKgRate),
    maximumWeightKg: rule.maximumWeightKg === null ? null : Number(rule.maximumWeightKg),
    weightIncrementKg: rule.weightIncrementKg === null ? null : Number(rule.weightIncrementKg),
    dimensionalPricingEnabled: rule.dimensionalPricingEnabled,
    volumetricDivisor: rule.volumetricDivisor === null ? null : Number(rule.volumetricDivisor),
    maxDistanceKm: rule.maxDistanceKm === null ? null : Number(rule.maxDistanceKm),
    allowGlobalFallback: rule.allowGlobalFallback,
    priority: rule.priority,
    revision: rule.revision,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    archivedAt: rule.archivedAt,
  };
}

// ─── Price estimate ───────────────────────────────────────────────────────────

export interface PriceEstimateDto {
  total: number;
  currency: string;
  baseFee: number;
  parcelAdjustment: number;
  breakdown: Array<{
    ruleId: string | null;
    ruleName: string;
    amount: number;
    note: string;
  }>;
  matchedRuleId: string | null;
}

// ─── Admin order counts ───────────────────────────────────────────────────────

export interface AdminOrderCountsDto {
  total: number;
  pending: number;
  confirmed: number;
  pickupScheduled: number;
  pickedUp: number;
  inTransit: number;
  inProgress: number;
  deliveryAttempted: number;
  delivered: number;
  completed: number;
  cancelled: number;
  failed: number;
  withRoute: number;
  withoutRoute: number;
}

// ─── User order counts ────────────────────────────────────────────────────────

export interface UserOrderCountsDto {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}
