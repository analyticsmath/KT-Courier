/**
 * Compatibility facade for legacy order callers.
 *
 * Phase 27 owns delivery: this module only appends durable, safe event intent.
 * It intentionally never receives or persists a destination address.
 */
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/types/db";
import { OrderStatus } from "@/types/db";
import { NotificationPolicyError } from "@/lib/notifications/contracts";
import { toInputJsonObject } from "@/lib/json/input-json";

async function append(eventType: string, aggregateReference: string, operationId: string, safePayload: Record<string, unknown>, db: Pick<Prisma.TransactionClient, "notificationEventIntent"> = prisma) {
  return db.notificationEventIntent.upsert({
    where: { operationId },
    update: {},
    create: { sourceAuthority: "LEGACY_ORDER", eventType, aggregateReference, operationId, safePayload: toInputJsonObject(safePayload) },
  });
}

async function appendAuthorityIntent(
  sourceAuthority: string,
  eventType: string,
  aggregateReference: string,
  operationId: string,
  safePayload: Record<string, unknown>,
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">> = prisma,
) {
  const delegate = db?.notificationEventIntent;
  if (!delegate || typeof delegate.upsert !== "function") return null;
  return delegate.upsert({
    where: { operationId },
    update: {},
    create: {
      sourceAuthority,
      eventType,
      aggregateReference,
      operationId,
      safePayload: toInputJsonObject(safePayload),
    },
  });
}

export async function appendOrderConfirmedInTx(db: Pick<Prisma.TransactionClient, "notificationEventIntent">, order: { id: string; orderNumber: string; deliveryType: string; source: string }) {
  await append("ORDER_CONFIRMED", order.id, `legacy-order-confirmed:${order.id}`, { orderNumber: order.orderNumber, deliveryType: order.deliveryType, source: order.source }, db);
}

export async function appendCourierBookingPendingPaymentInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  order: { id: string; orderNumber: string; deliveryType: string; source: string },
) {
  await appendAuthorityIntent(
    "COURIER_ORDER",
    "COURIER_BOOKING_PENDING_PAYMENT",
    order.id,
    `courier-booking-pending:${order.id}`,
    { orderNumber: order.orderNumber, deliveryType: order.deliveryType, source: order.source },
    db,
  );
}

export async function appendCourierPaymentConfirmedInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  order: { id: string; orderNumber: string; paymentReference: string },
) {
  await appendAuthorityIntent(
    "COURIER_ORDER",
    "COURIER_PAYMENT_CONFIRMED",
    order.id,
    `courier-payment-confirmed:${order.id}:${order.paymentReference}`,
    { orderNumber: order.orderNumber, paymentReference: order.paymentReference },
    db,
  );
}

export async function appendCourierOrderAcceptedInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  order: { id: string; orderNumber: string; deliveryType?: string; source?: string },
) {
  await appendAuthorityIntent(
    "COURIER_ORDER",
    "COURIER_ACCEPTED",
    order.id,
    `courier-accepted:${order.id}`,
    { orderNumber: order.orderNumber, ...(order.deliveryType ? { deliveryType: order.deliveryType } : {}), ...(order.source ? { source: order.source } : {}) },
    db,
  );
}

export async function appendCourierPaymentFailedInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  input: { orderId: string; orderNumber: string; historyId: string; status: string },
) {
  await appendAuthorityIntent(
    "COURIER_ORDER",
    "COURIER_PAYMENT_FAILED",
    input.orderId,
    `courier-payment-failed:${input.orderId}:${input.historyId}`,
    { orderNumber: input.orderNumber, sourceEventId: input.historyId, status: input.status },
    db,
  );
}

export async function appendCourierUnpaidCancelledInTx(
  db: Partial<Pick<Prisma.TransactionClient, "notificationEventIntent">>,
  order: { id: string; orderNumber: string; reasonCode?: string },
) {
  await appendAuthorityIntent(
    "COURIER_ORDER",
    "COURIER_UNPAID_CANCELLED",
    order.id,
    `courier-unpaid-cancelled:${order.id}`,
    { orderNumber: order.orderNumber, reasonCode: order.reasonCode ?? "PAYMENT_DEADLINE_EXPIRED" },
    db,
  );
}

export async function appendOrderStatusChangedInTx(db: Pick<Prisma.TransactionClient, "notificationEventIntent">, order: { id: string; orderNumber: string; status: string; source: string; pricingSnapshot?: unknown }, historyId: string) {
  // Marketplace execution projects a canonical COURIER_* store-order event in
  // this transaction. Its checkout recipient policy supports both account and
  // verified guest customers; the legacy customer-only route would duplicate
  // account messages and cannot resolve a guest shipment.
  const snapshot = order.pricingSnapshot;
  if (snapshot && typeof snapshot === "object" && "marketplaceStoreOrderReference" in snapshot) return;
  await append("ORDER_STATUS_CHANGED", order.id, `legacy-order-status-history:${historyId}`, { orderNumber: order.orderNumber, status: order.status, source: order.source }, db);
}

export interface OrderConfirmedEvent {
  recipientEmail: string;
  recipientName: string;
  orderNumber: string;
  deliveryType: string;
  pickupSummary: string;
  dropoffSummary: string;
  priceEstimate: number | null;
  currency: string;
  orderId: string;
  source: string;
  submittedByEmail: string;
}

export async function notifyOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
  await append("ORDER_CONFIRMED", event.orderId, `legacy-order-confirmed:${event.orderId}`, { orderNumber: event.orderNumber, deliveryType: event.deliveryType, source: event.source });
}

export interface OrderStatusChangedEvent {
  recipientEmail: string;
  recipientName: string;
  orderNumber: string;
  newStatus: string;
  statusNote?: string;
  orderId: string;
  source: string;
}

export async function notifyOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
  const status = Object.values(OrderStatus).find((value) => value === event.newStatus);
  if (!status) throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID");
  const history = await prisma.orderStatusHistory.findFirst({ where: { orderId: event.orderId, status }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  if (!history) throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID");
  await append("ORDER_STATUS_CHANGED", event.orderId, `legacy-order-status-history:${history.id}`, { orderNumber: event.orderNumber, status: history.status, source: event.source });
}

export interface DeliveryOtpEvent {
  recipientEmail: string;
  recipientName: string;
  otp: string;
  expiresMinutes: number;
  orderNumber: string;
  orderId: string;
  source: string;
}

/** OTP delivery itself remains an authentication/security authority; this only emits an inbox intent. */
export async function notifyDeliveryOtp(event: DeliveryOtpEvent): Promise<void> {
  await append("DELIVERY_OTP_ISSUED", event.orderId, `legacy-delivery-otp:${event.orderId}:${event.expiresMinutes}`, { orderNumber: event.orderNumber, source: event.source, expiresMinutes: event.expiresMinutes });
}
