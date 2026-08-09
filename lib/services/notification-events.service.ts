/**
 * Compatibility facade for legacy order callers.
 *
 * Phase 27 owns delivery: this module only appends durable, safe event intent.
 * It intentionally never receives or persists a destination address.
 */
import { prisma } from "@/lib/db/prisma";
import { toInputJsonObject } from "@/lib/json/input-json";

async function append(eventType: string, aggregateReference: string, operationId: string, safePayload: Record<string, unknown>) {
  return prisma.notificationEventIntent.upsert({
    where: { operationId },
    update: {},
    create: { sourceAuthority: "LEGACY_ORDER", eventType, aggregateReference, operationId, safePayload: toInputJsonObject(safePayload) },
  });
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
  await append("ORDER_STATUS_CHANGED", event.orderId, `legacy-order-status:${event.orderId}:${event.newStatus}`, { orderNumber: event.orderNumber, status: event.newStatus, source: event.source });
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
