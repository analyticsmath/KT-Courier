import type { Prisma } from "@prisma/client";
import { NotificationPolicyError } from "./contracts";

type Intent = { sourceAuthority: string; eventType: string; aggregateReference: string; operationId: string; safePayload: unknown };
const unsupported = (): never => { throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_NOT_SUPPORTED"); };
const invalid = (): never => { throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID"); };
const statusText = (status: string) => status.replaceAll("_", " ").toLowerCase();
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Destinations and recipient IDs are always reconstructed from canonical ownership. */
export async function resolveRequiredDomainPayload(db: Prisma.TransactionClient, intent: Intent): Promise<Record<string, unknown>> {
  const raw = object(intent.safePayload);
  if (intent.sourceAuthority === "LEGACY_ORDER") {
    const order = await db.order.findUnique({ where: { id: intent.aggregateReference }, select: { customerId: true, orderNumber: true } });
    return { customerUserId: order?.customerId ?? null, orderNumber: order?.orderNumber ?? null, ...(intent.eventType === "ORDER_STATUS_CHANGED" ? { status: typeof raw.status === "string" ? statusText(raw.status) : null } : {}) };
  }
  if (intent.sourceAuthority === "MARKETPLACE") {
    const order = await db.marketplaceOrder.findUnique({ where: { id: intent.aggregateReference }, include: { checkout: { select: { publicReference: true, customerUserId: true } } } });
    if (!order || intent.eventType !== "MARKETPLACE_ORDER_CONFIRMED" || order.customerUserId !== order.checkout.customerUserId) return invalid();
    return { customerUserId: order.customerUserId, checkoutReference: order.checkout.publicReference, orderNumber: order.publicReference };
  }
  if (intent.sourceAuthority === "STORE_ORDERS") {
    const order = await db.marketplaceStoreOrder.findUnique({ where: { id: intent.aggregateReference }, include: { store: { select: { ownerUserId: true, status: true } }, marketplaceOrder: { include: { checkout: { select: { publicReference: true, customerUserId: true } } } } } });
    if (!order || order.marketplaceOrder.customerUserId !== order.marketplaceOrder.checkout.customerUserId) return invalid();
    if (intent.eventType === "STORE_ORDER_RECEIVED") return { storeOwnerUserId: order.store.status === "ACTIVE" ? order.store.ownerUserId : null, orderNumber: order.publicReference };
    const source = typeof raw.sourceEventId === "string" ? await db.marketplaceStoreOrderEventIntent.findUnique({ where: { id: raw.sourceEventId } }) : null;
    if (!source || source.marketplaceStoreOrderId !== order.id || source.eventType !== intent.eventType) return invalid();
    return { customerUserId: order.marketplaceOrder.customerUserId, checkoutReference: order.marketplaceOrder.checkout.publicReference, orderNumber: order.publicReference, status: statusText(source.eventType) };
  }
  if (intent.sourceAuthority === "PAYMENT" || intent.sourceAuthority === "REFUND") {
    const refund = intent.sourceAuthority === "REFUND" ? await db.paymentRefund.findUnique({ where: { id: intent.aggregateReference } }) : null;
    const payment = refund
      ? await db.payment.findUnique({ where: { id: refund.paymentId } })
      : intent.sourceAuthority === "PAYMENT" ? await db.payment.findUnique({ where: { publicReference: intent.aggregateReference } }) : null;
    if (!payment || (refund && refund.customerUserId !== payment.userId)) return invalid();
    const checkout = payment.marketplaceCheckoutId ? await db.marketplaceCheckout.findUnique({ where: { id: payment.marketplaceCheckoutId }, select: { publicReference: true, customerUserId: true } }) : null;
    const order = payment.orderId ? await db.order.findUnique({ where: { id: payment.orderId }, select: { customerId: true } }) : null;
    if ((payment.marketplaceCheckoutId && !checkout) || (payment.orderId && !order) || (checkout && checkout.customerUserId !== payment.userId) || (order && order.customerId !== payment.userId)) return invalid();
    const recipient = { customerUserId: payment.userId, checkoutReference: checkout?.publicReference ?? null };
    if (intent.eventType === "PAYMENT_SUCCEEDED_VERIFIED" && intent.sourceAuthority === "PAYMENT") {
      const evidence = await db.paymentVerifiedEventIntent.findUnique({ where: { paymentId: payment.id } });
      if (!evidence || !["SUCCEEDED"].includes(payment.status) || payment.successfulAttemptId !== evidence.successfulAttemptId || payment.successWebhookEventId !== evidence.webhookEventId || !payment.successLedgerJournalId || !payment.amount.equals(evidence.amount) || payment.currency !== evidence.currency || intent.operationId !== `payment-verified-notification:${evidence.eventIdentity}`) return invalid();
      return { ...recipient, paymentReference: payment.publicReference, amount: payment.amount.toFixed(2) };
    }
    if (intent.eventType === "PAYMENT_STATUS_CHANGED" && intent.sourceAuthority === "PAYMENT") {
      const history = typeof raw.sourceEventId === "string" ? await db.paymentStatusHistory.findUnique({ where: { id: raw.sourceEventId } }) : null;
      if (!history || history.paymentId !== payment.id || !["FAILED", "CANCELLED", "EXPIRED"].includes(history.toStatus)) return invalid();
      return { ...recipient, paymentReference: payment.publicReference, status: statusText(history.toStatus) };
    }
    if (refund && intent.eventType === "REFUND_STATUS_CHANGED") {
      const history = typeof raw.sourceEventId === "string" ? await db.refundStatusHistory.findUnique({ where: { id: raw.sourceEventId } }) : null;
      if (!history || history.refundId !== refund.id || (history.toStatus === "SUCCEEDED" && (!refund.completionLedgerJournalId || !refund.completedAt))) return invalid();
      return { ...recipient, refundReference: refund.publicReference, amount: refund.amount.toFixed(2), status: statusText(history.toStatus) };
    }
  }
  return unsupported();
}
