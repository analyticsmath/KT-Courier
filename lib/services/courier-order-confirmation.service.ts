import { OrderStatus, type Prisma } from "@/types/db";
import { PaymentError } from "@/lib/payments/errors";
import { getCourierPaymentReadiness } from "@/lib/services/courier-payment-readiness.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import {
  appendCourierOrderAcceptedInTx,
  appendCourierPaymentConfirmedInTx,
} from "@/lib/services/notification-events.service";
import { recordAdminAlertIntentInTx } from "@/lib/notifications/admin-alert-dispatch.service";

/**
 * Called only after the provider's signed payment and exact amount have been
 * independently verified and the success journal has been committed within
 * the caller's transaction. Both Paystack and PayFast use this authority.
 */
export async function confirmVerifiedCourierOrderWithinTransaction(
  tx: Prisma.TransactionClient,
  payment: Readonly<{
    subjectType: string;
    orderId: string | null;
    publicReference: string;
  }>,
): Promise<void> {
  if (payment.subjectType !== "COURIER_ORDER") return;
  if (!payment.orderId) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Verified parcel payment has no courier order.");
  }
  const readiness = await getCourierPaymentReadiness(payment.orderId, tx);
  if (
    !readiness.dispatchEligible ||
    !["PAID", "DEPOSIT_PAID_CASH_DUE"].includes(readiness.status) ||
    readiness.paymentReference !== payment.publicReference
  ) {
    throw new PaymentError("PAYMENT_INVALID_STATE", "Parcel cannot be confirmed without its own verified financial receipt.");
  }

  const order = await tx.order.findUnique({
    where: { id: payment.orderId },
    select: { id: true, orderNumber: true, status: true },
  });
  if (!order) throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Verified parcel payment has no order.");
  // A late provider callback can arrive after cancellation. Preserve the
  // financial receipt for reconciliation without reviving terminal custody.
  if (order.status !== OrderStatus.PENDING) return;

  await transitionOrderStatusInTx(tx, {
    orderId: payment.orderId,
    fromStatus: OrderStatus.PENDING,
    toStatus: OrderStatus.CONFIRMED,
    actorRole: "SYSTEM",
    source: "verified_courier_payment",
    note: "Delivery payment verified and recorded in the financial ledger.",
    context: { isPaid: true },
  });

  if (order.orderNumber) {
    await appendCourierPaymentConfirmedInTx(tx, {
      id: payment.orderId,
      orderNumber: order.orderNumber,
      paymentReference: payment.publicReference,
    });
    await appendCourierOrderAcceptedInTx(tx, {
      id: payment.orderId,
      orderNumber: order.orderNumber,
    });
    await recordAdminAlertIntentInTx(tx, {
      eventType: "PARCEL_ORDER_ACCEPTED",
      aggregateReference: `parcel-accepted:${payment.orderId}`,
      title: `Parcel automatically accepted (${order.orderNumber})`,
      summary: `Payment ${payment.publicReference} verified in ledger; parcel moved to CONFIRMED.`,
      adminPath: `/admin/orders/${payment.orderId}`,
      relatedOrderId: payment.orderId,
      metadata: {
        orderNumber: order.orderNumber,
        paymentReference: payment.publicReference,
      },
    });
  }
}
