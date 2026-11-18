import type { Prisma } from "@prisma/client";
import { NotificationPolicyError } from "./contracts";
import { resolveOperationalDomainPayload } from "./operational-domain-payload";
import { canReceiveConversationUpdate } from "@/lib/client-platform/conversations.service";

type Intent = { sourceAuthority: string; eventType: string; aggregateReference: string; operationId: string; safePayload: unknown };
const unsupported = (): never => { throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_NOT_SUPPORTED"); };
const invalid = (): never => { throw new NotificationPolicyError("CLIENT_NOTIFICATION_SOURCE_EVIDENCE_INVALID"); };
const requireOperation = (intent: Intent, operationId: string) => { if (intent.operationId !== operationId) invalid(); };
const statusText = (status: string) => status.replaceAll("_", " ").toLowerCase();
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Destinations and recipient IDs are always reconstructed from canonical ownership. */
export async function resolveRequiredDomainPayload(db: Prisma.TransactionClient, intent: Intent): Promise<Record<string, unknown>> {
  const raw = object(intent.safePayload);
  if (["DISPATCH", "WITHDRAWAL", "STORE_EARNINGS", "DRIVER_EARNINGS"].includes(intent.sourceAuthority)) return resolveOperationalDomainPayload(db, intent);
  if (intent.sourceAuthority === "CONVERSATION") {
    if (intent.eventType !== "CONVERSATION_MESSAGE_RECEIVED" || typeof raw.sourceEventId !== "string" || typeof raw.recipientUserId !== "string") return invalid();
    requireOperation(intent, `conversation-message-notification:${raw.sourceEventId}:${raw.recipientUserId}`);
    const message = await db.platformConversationMessage.findUnique({ where: { id: raw.sourceEventId }, select: { conversationId: true, senderUserId: true } });
    if (!message || message.conversationId !== intent.aggregateReference || message.senderUserId === raw.recipientUserId || !await canReceiveConversationUpdate(db, raw.recipientUserId, message.conversationId)) return invalid();
    return { actorUserId: raw.recipientUserId };
  }
  if (intent.sourceAuthority === "ACCOUNT") {
    if (intent.eventType !== "ACCOUNT_EMAIL_VERIFIED") return unsupported();
    requireOperation(intent, `account-welcome:${intent.aggregateReference}`);
    const user = await db.user.findUnique({
      where: { id: intent.aggregateReference },
      select: { id: true, status: true, emailVerifiedAt: true },
    });
    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) return invalid();
    return { actorUserId: user.id };
  }
  if (intent.sourceAuthority === "LEGACY_ORDER") {
    const order = await db.order.findUnique({ where: { id: intent.aggregateReference }, select: { customerId: true, orderNumber: true } });
    if (!order) return invalid();
    const recipient = { customerUserId: order.customerId, orderNumber: order.orderNumber };
    if (intent.eventType === "ORDER_CONFIRMED") {
      requireOperation(intent, `legacy-order-confirmed:${intent.aggregateReference}`);
      return recipient;
    }
    if (intent.eventType === "ORDER_STATUS_CHANGED") {
      const prefix = "legacy-order-status-history:";
      if (!intent.operationId.startsWith(prefix)) return invalid();
      const history = await db.orderStatusHistory.findUnique({ where: { id: intent.operationId.slice(prefix.length) } });
      if (!history || history.orderId !== intent.aggregateReference) return invalid();
      return { ...recipient, status: statusText(history.status) };
    }
    return unsupported();
  }
  if (intent.sourceAuthority === "COURIER_ORDER") {
    const order = await db.order.findUnique({
      where: { id: intent.aggregateReference },
      select: {
        id: true,
        customerId: true,
        orderNumber: true,
        status: true,
        payments: {
          where: { subjectType: "COURIER_ORDER", status: "SUCCEEDED", successLedgerJournalId: { not: null } },
          take: 1,
          select: { publicReference: true },
        },
        cashOnDelivery: { select: { policyMode: true, status: true } },
      },
    });
    if (!order) return invalid();
    const recipient = { customerUserId: order.customerId, orderNumber: order.orderNumber };
    if (intent.eventType === "COURIER_BOOKING_PENDING_PAYMENT") {
      requireOperation(intent, `courier-booking-pending:${order.id}`);
      return recipient;
    }
    if (intent.eventType === "COURIER_PAYMENT_CONFIRMED") {
      const paymentRef = typeof raw.paymentReference === "string" ? raw.paymentReference : order.payments[0]?.publicReference;
      if (!paymentRef || !order.payments.some((p) => p.publicReference === paymentRef)) return invalid();
      requireOperation(intent, `courier-payment-confirmed:${order.id}:${paymentRef}`);
      return recipient;
    }
    if (intent.eventType === "COURIER_ACCEPTED") {
      requireOperation(intent, `courier-accepted:${order.id}`);
      const hasAcceptedHistory =
        order.status !== "PENDING" && order.status !== "CANCELLED"
          ? true
          : Boolean(
              await db.orderStatusHistory.findFirst({
                where: { orderId: order.id, status: "CONFIRMED" },
                select: { id: true },
              }),
            );
      if (!hasAcceptedHistory) return invalid();
      return recipient;
    }
    if (intent.eventType === "COURIER_PAYMENT_FAILED") {
      const historyId = typeof raw.sourceEventId === "string" ? raw.sourceEventId : null;
      if (!historyId) return invalid();
      const history = await db.paymentStatusHistory.findUnique({
        where: { id: historyId },
        select: { toStatus: true, payment: { select: { orderId: true } } },
      });
      if (!history || history.payment.orderId !== order.id || !["FAILED", "CANCELLED", "EXPIRED"].includes(history.toStatus)) {
        return invalid();
      }
      requireOperation(intent, `courier-payment-failed:${order.id}:${historyId}`);
      return recipient;
    }
    if (intent.eventType === "COURIER_UNPAID_CANCELLED") {
      requireOperation(intent, `courier-unpaid-cancelled:${order.id}`);
      if (order.status !== "CANCELLED") return invalid();
      return recipient;
    }
    return unsupported();
  }
  if (intent.sourceAuthority === "MARKETPLACE") {
    const order = await db.marketplaceOrder.findUnique({ where: { id: intent.aggregateReference }, include: { checkout: { select: { publicReference: true, customerUserId: true } } } });
    if (!order || intent.eventType !== "MARKETPLACE_ORDER_CONFIRMED" || order.customerUserId !== order.checkout.customerUserId) return invalid();
    requireOperation(intent, `marketplace-order-notification:${intent.aggregateReference}`);
    return { customerUserId: order.customerUserId, checkoutReference: order.checkout.publicReference, orderNumber: order.publicReference };
  }
  if (intent.sourceAuthority === "STORE_ORDERS") {
    const order = await db.marketplaceStoreOrder.findUnique({ where: { id: intent.aggregateReference }, include: { store: { select: { ownerUserId: true, status: true } }, marketplaceOrder: { include: { checkout: { select: { publicReference: true, customerUserId: true } } } } } });
    if (!order || order.marketplaceOrder.customerUserId !== order.marketplaceOrder.checkout.customerUserId) return invalid();
    if (intent.eventType === "STORE_ORDER_RECEIVED") {
      requireOperation(intent, `vendor-order-notification:${intent.aggregateReference}`);
      return { storeOwnerUserId: order.store.status === "ACTIVE" ? order.store.ownerUserId : null, orderNumber: order.publicReference };
    }
    const source = typeof raw.sourceEventId === "string" ? await db.marketplaceStoreOrderEventIntent.findUnique({ where: { id: raw.sourceEventId } }) : null;
    if (!source || source.marketplaceStoreOrderId !== order.id || source.eventType !== intent.eventType) return invalid();
    requireOperation(intent, `store-order-notification:${raw.sourceEventId}`);
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
      requireOperation(intent, `payment-status-notification:${raw.sourceEventId}`);
      return { ...recipient, paymentReference: payment.publicReference, status: statusText(history.toStatus) };
    }
    if (refund && intent.eventType === "REFUND_STATUS_CHANGED") {
      const history = typeof raw.sourceEventId === "string" ? await db.refundStatusHistory.findUnique({ where: { id: raw.sourceEventId } }) : null;
      if (!history || history.refundId !== refund.id || (!history.operationId && !history.fromStatus) || (history.toStatus === "SUCCEEDED" && (!refund.completionLedgerJournalId || !refund.completedAt))) return invalid();
      requireOperation(intent, `refund-status-notification:${raw.sourceEventId}`);
      return { ...recipient, refundReference: refund.publicReference, amount: refund.amount.toFixed(2), status: statusText(history.toStatus) };
    }
  }
  return unsupported();
}
