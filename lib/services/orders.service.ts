import { prisma } from "@/lib/db/prisma";
import { OrderSource, OrderStatus } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import { generateOrderNumber } from "@/lib/utils/order-number";
import {
  toOrderSummaryDto,
  toOrderDetailDto,
  type OrderSummaryDto,
  type OrderDetailDto,
  type UserOrderCountsDto,
} from "@/lib/dto/order.dto";
import type { CreateOrderInput, CustomerCancelOrderInput } from "@/lib/validation/order";
import { notifyOrderConfirmed, notifyOrderStatusChanged } from "./notification-events.service";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";
import { ownedActiveQuoteForOrder } from "@/lib/services/pricing-quote.service";
import { canTransitionOrderStatus } from "@/lib/orders/order-state-machine";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { resolvePaymentBreakdown } from "@/lib/payments/payment-policy.service";
import { createCashOnDeliveryObligationWithinTransaction } from "@/lib/services/cash-on-delivery.service";

// ─── Full include for order queries ──────────────────────────────────────────

const ORDER_FULL_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
  statusHistory: {
    include: { actorUser: true },
    orderBy: { createdAt: "asc" as const },
  },
  customer: true,
  store: true,
} as const;

const ORDER_LIST_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOwnedStoreId(userId: string): Promise<string | null> {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return store?.id ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOrder(
  user: AuthenticatedUser,
  input: CreateOrderInput
): Promise<OrderDetailDto> {
  let storeId: string | null = null;
  let customerId: string | null = null;
  let source: OrderSource;

  if (user.role === OrderSource.STORE) {
    storeId = await getOwnedStoreId(user.id);
    if (!storeId) throw new Error("No store found for this account.");
    source = OrderSource.STORE;
  } else if (user.role === "CUSTOMER") {
    customerId = user.id;
    source = OrderSource.CUSTOMER;
  } else {
    throw new Error("Only customers and store accounts can create orders.");
  }

  const orderNumber = await generateOrderNumber();
  // Must match the input snapshot created by the quote endpoint. Pricing inputs
  // are never accepted as order fields, only the quote identifier is.
  const quoteInputHash = hashPricingInput(pricingInputSnapshot(input));

  const result = await prisma.$transaction(async (tx) => {
    const quote = await ownedActiveQuoteForOrder(tx, user, input.pricingQuoteId, quoteInputHash);
    const committedPayment = input.paymentMethod ? await resolvePaymentBreakdown({ storeId, orderType: input.deliveryType, authoritativeTotal: quote.total.toFixed(2) }) : null;
    if (input.paymentMethod && committedPayment!.mode !== input.paymentMethod) throw new Error("PAYMENT_METHOD_NOT_ALLOWED");
    const pickup = await tx.address.create({
      data: {
        type: "PICKUP",
        contactName: input.pickupAddress.contactName ?? null,
        contactPhone: input.pickupAddress.contactPhone ?? null,
        line1: input.pickupAddress.line1,
        line2: input.pickupAddress.line2 ?? null,
        city: input.pickupAddress.city ?? null,
        province: input.pickupAddress.province ?? null,
        postalCode: input.pickupAddress.postalCode ?? null,
        country: input.pickupAddress.country ?? "South Africa",
        accessNotes: input.pickupAddress.accessNotes ?? null,
        formattedAddress: input.pickupAddress.formattedAddress ?? null,
        placeId: input.pickupAddress.placeId ?? null,
        latitude: input.pickupAddress.latitude ?? null,
        longitude: input.pickupAddress.longitude ?? null,
      },
    });

    const dropoff = await tx.address.create({
      data: {
        type: "DROPOFF",
        contactName: input.dropoffAddress.contactName ?? input.recipientName,
        contactPhone: input.dropoffAddress.contactPhone ?? input.recipientPhone,
        line1: input.dropoffAddress.line1,
        line2: input.dropoffAddress.line2 ?? null,
        city: input.dropoffAddress.city ?? null,
        province: input.dropoffAddress.province ?? null,
        postalCode: input.dropoffAddress.postalCode ?? null,
        country: input.dropoffAddress.country ?? "South Africa",
        accessNotes: input.dropoffAddress.accessNotes ?? null,
        formattedAddress: input.dropoffAddress.formattedAddress ?? null,
        placeId: input.dropoffAddress.placeId ?? null,
        latitude: input.dropoffAddress.latitude ?? null,
        longitude: input.dropoffAddress.longitude ?? null,
      },
    });

    const order = await tx.order.create({
      data: {
        orderNumber,
        source,
        status: OrderStatus.PENDING,
        deliveryType: input.deliveryType,
        currency: quote.currency,
        customerId,
        storeId,
        pickupAddressId: pickup.id,
        dropoffAddressId: dropoff.id,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        parcelDescription: input.parcelDescription ?? null,
        parcelCount: input.parcelCount,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        priceEstimate: quote.total,
        pricingQuoteId: quote.id,
        pricingSubtotal: quote.subtotal,
        pricingTaxAmount: quote.taxAmount,
        pricingTaxRate: quote.taxRate,
        pricingSnapshot: {
          quoteId: quote.id,
          calculationVersion: quote.calculationVersion,
          input: quote.inputSnapshot,
          rule: quote.ruleSnapshot,
          regions: quote.regionSnapshot,
          tax: quote.taxSnapshot,
          lineItems: quote.lineItems.map((item) => ({ code: item.code, label: item.label, quantity: item.quantity?.toString() ?? null, unitRate: item.unitRate?.toString() ?? null, amount: item.amount.toFixed(2), currency: item.currency })),
          paymentPolicy: committedPayment ? { ...committedPayment.policyEvidence, digitalRequired: committedPayment.digitalRequired, cashRequired: committedPayment.cashRequired } : null,
        },
        customerNote: input.customerNote ?? null,
        distanceMeters: quote.distanceMeters,
        durationSeconds: quote.durationSeconds,
        routeSummary: (quote.metadata as { routeSummary?: string } | null)?.routeSummary ?? null,
        routeProvider: quote.routeProvider,
        routeCalculatedAt: quote.createdAt,
        deliveryRegionId: quote.destinationRegionId,
      },
      include: ORDER_FULL_INCLUDE,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PENDING,
        note: "Order created",
        actorUserId: user.id,
      },
    });
    if (committedPayment && committedPayment.mode !== "DIGITAL_ONLY") {
      await createCashOnDeliveryObligationWithinTransaction(tx, { orderId: order.id, policyMode: committedPayment.mode, authoritativePayable: committedPayment.authoritativeTotal, digitalRequired: committedPayment.digitalRequired, policyEvidence: committedPayment.policyEvidence });
    }

    return order;
  });

  const dto = toOrderDetailDto(result);

  notifyOrderConfirmed({
    recipientEmail: user.email,
    recipientName: user.name ?? user.email,
    orderNumber: dto.orderNumber,
    deliveryType: dto.deliveryType,
    pickupSummary: dto.pickupSummary,
    dropoffSummary: dto.dropoffSummary,
    priceEstimate: dto.priceEstimate,
    currency: dto.currency,
    orderId: dto.id,
    source: dto.source,
    submittedByEmail: user.email,
  });

  return dto;
}

// ─── List (customer or store) ─────────────────────────────────────────────────

export interface OrderListFilters {
  status?: OrderStatus;
  page: number;
  pageSize: number;
}

export async function listOrders(
  user: AuthenticatedUser,
  filters: OrderListFilters
): Promise<{ data: OrderSummaryDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where = await buildOwnerWhere(user);
  if (filters.status) (where as Record<string, unknown>).status = filters.status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { data: orders.map(toOrderSummaryDto), total };
}

// ─── Get single order (ownership enforced) ───────────────────────────────────

export async function getOrder(
  user: AuthenticatedUser,
  orderId: string
): Promise<OrderDetailDto | null> {
  const where = await buildOwnerWhere(user);
  (where as Record<string, unknown>).id = orderId;

  const order = await prisma.order.findFirst({
    where,
    include: ORDER_FULL_INCLUDE,
  });

  return order ? toOrderDetailDto(order) : null;
}

// ─── Repeat delivery prefill (ownership enforced) ────────────────────────────

export interface RepeatDeliveryAddressPrefill {
  formattedAddress: string;
  placeId: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  accessNotes: string | null;
}

export interface RepeatDeliveryPrefillDto {
  sourceOrderNumber: string;
  deliveryType: string;
  pickupAddress: RepeatDeliveryAddressPrefill | null;
  dropoffAddress: RepeatDeliveryAddressPrefill | null;
  recipientName: string;
  recipientPhone: string;
  parcelCount: number;
  parcelDescription: string;
  customerNote: string;
}

function toRepeatAddressPrefill(
  address: OrderDetailDto["pickupAddress"] | OrderDetailDto["dropoffAddress"]
): RepeatDeliveryAddressPrefill | null {
  if (!address) return null;
  return {
    formattedAddress:
      address.formattedAddress ??
      [address.line1, address.city, address.province, address.postalCode, address.country]
        .filter(Boolean)
        .join(", "),
    placeId: address.placeId,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    latitude: address.latitude,
    longitude: address.longitude,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    accessNotes: address.accessNotes,
  };
}

export async function getRepeatDeliveryPrefill(
  user: AuthenticatedUser,
  orderId: string
): Promise<RepeatDeliveryPrefillDto | null> {
  const order = await getOrder(user, orderId);
  if (!order) return null;

  return {
    sourceOrderNumber: order.orderNumber,
    deliveryType: order.deliveryType,
    pickupAddress: toRepeatAddressPrefill(order.pickupAddress),
    dropoffAddress: toRepeatAddressPrefill(order.dropoffAddress),
    recipientName: order.recipientName ?? order.dropoffAddress?.contactName ?? "",
    recipientPhone: order.recipientPhone ?? order.dropoffAddress?.contactPhone ?? "",
    parcelCount: order.parcelCount,
    parcelDescription: order.parcelDescription ?? "",
    customerNote: order.customerNote ?? "",
  };
}

// ─── Cancel (customer/store — only before pickup) ────────────────────────────

export async function cancelOrder(
  user: AuthenticatedUser,
  orderId: string,
  input: CustomerCancelOrderInput
): Promise<{ order: OrderDetailDto } | { error: string }> {
  const where = await buildOwnerWhere(user);
  (where as Record<string, unknown>).id = orderId;

  const existing = await prisma.order.findFirst({
    where,
    select: { id: true, orderNumber: true, status: true, source: true },
  });

  if (!existing) return { error: "Order not found." };

  const context = {
    actorOwnsOrder: user.role === "CUSTOMER",
    actorOwnsStore: user.role === "STORE",
    cancellationWindowOpen: true,
  };

  if (
    !canTransitionOrderStatus({
      from: existing.status,
      to: OrderStatus.CANCELLED,
      actorRole: user.role,
      context,
    })
  ) {
    return {
      error: `This order cannot be cancelled once it has progressed to ${existing.status}. Please contact KT Couriers for assistance.`,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    await transitionOrderStatusInTx(tx, {
      orderId,
      fromStatus: existing.status,
      toStatus: OrderStatus.CANCELLED,
      actorUserId: user.id,
      actorRole: user.role,
      reason: input.reason,
      note: input.reason?.trim()
        ? `Cancelled by ${user.role === "STORE" ? "store" : "customer"}: ${input.reason.trim()}`
        : `Cancelled by ${user.role === "STORE" ? "store" : "customer"}`,
      source: user.role === "STORE" ? "store_cancel_order" : "customer_cancel_order",
      context,
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_FULL_INCLUDE,
    });
  });

  // Notify admin (non-blocking — reuse status-changed event)
  notifyOrderStatusChanged({
    recipientEmail: user.email,
    recipientName: user.name ?? user.email,
    orderNumber: existing.orderNumber,
    newStatus: OrderStatus.CANCELLED,
    statusNote: input.reason ?? undefined,
    orderId,
    source: existing.source,
  });

  return { order: toOrderDetailDto(updated) };
}

// ─── Order counts (for dashboard) ────────────────────────────────────────────

export async function getOrderCounts(user: AuthenticatedUser): Promise<UserOrderCountsDto> {
  const base = await buildOwnerWhere(user);

  const [total, pending, confirmed, inProgress, completed, cancelled] = await Promise.all([
    prisma.order.count({ where: base }),
    prisma.order.count({ where: { ...base, status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { ...base, status: OrderStatus.CONFIRMED } }),
    prisma.order.count({ where: { ...base, status: { in: [OrderStatus.IN_PROGRESS, OrderStatus.PICKUP_SCHEDULED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERY_ATTEMPTED] } } }),
    prisma.order.count({ where: { ...base, status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] } } }),
    prisma.order.count({ where: { ...base, status: OrderStatus.CANCELLED } }),
  ]);

  return { total, pending, confirmed, inProgress, completed, cancelled };
}

// ─── Private: build ownership where clause ───────────────────────────────────

async function buildOwnerWhere(user: AuthenticatedUser): Promise<Record<string, unknown>> {
  if (user.role === "CUSTOMER") {
    return { customerId: user.id };
  }

  if (user.role === "STORE") {
    const storeId = await getOwnedStoreId(user.id);
    if (!storeId) return { storeId: "__no_store__" };
    return { storeId };
  }

  return {};
}
