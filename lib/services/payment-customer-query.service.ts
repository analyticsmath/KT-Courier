import { prisma } from "@/lib/db/prisma";
import type { CustomerPaymentPageDto, CustomerPaymentStatusDto } from "@/lib/dto/payment.dto";
import { PaymentError } from "@/lib/payments/errors";
import { resolveOrderPaymentSubject } from "./payment-subject.service";

function toCustomerStatus(payment: {
  publicReference: string;
  provider: string | null;
  status: string;
  amount: { toFixed(digits: number): string };
  updatedAt: Date;
  order: { orderNumber: string } | null;
}): CustomerPaymentStatusDto {
  if (!payment.order) {
    throw new PaymentError("PAYMENT_ORDER_NOT_FOUND", "Payment order relationship is incomplete.");
  }
  return Object.freeze({
    publicReference: payment.publicReference,
    orderReference: payment.order.orderNumber,
    amount: payment.amount.toFixed(2),
    currency: "ZAR",
    provider: payment.provider === "PAYFAST" ? "PAYFAST" : null,
    status: payment.status as CustomerPaymentStatusDto["status"],
    updatedAt: payment.updatedAt.toISOString(),
  });
}

export async function getCustomerPaymentStatus(
  payerId: string,
  publicReference: string,
): Promise<CustomerPaymentStatusDto | null> {
  const payment = await prisma.payment.findFirst({
    where: { publicReference, userId: payerId },
    include: { order: { select: { orderNumber: true } } },
  });
  return payment?.order ? toCustomerStatus(payment) : null;
}

export async function getOwnedPaymentIdentity(
  payerId: string,
  publicReference: string,
): Promise<Readonly<{
  id: string;
  publicReference: string;
  status: string;
  currentAttemptReference: string | null;
  currentActionType: string | null;
}> | null> {
  const payment = await prisma.payment.findFirst({
    where: { publicReference, userId: payerId },
    select: {
      id: true,
      publicReference: true,
      status: true,
      attempts: {
        orderBy: { attemptNumber: "desc" },
        take: 1,
        select: { publicReference: true, checkoutActionType: true },
      },
    },
  });
  return payment ? Object.freeze({
    id: payment.id,
    publicReference: payment.publicReference,
    status: payment.status,
    currentAttemptReference: payment.attempts[0]?.publicReference ?? null,
    currentActionType: payment.attempts[0]?.checkoutActionType ?? null,
  }) : null;
}

export async function getCustomerPaymentPage(
  payer: Readonly<{ id: string; email: string }>,
  orderReference: string,
): Promise<CustomerPaymentPageDto | null> {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: orderReference,
      OR: [
        { customerId: payer.id },
        { store: { ownerUserId: payer.id } },
      ],
    },
    select: { id: true, orderNumber: true },
  });
  if (!order) return null;
  const payment = await prisma.payment.findUnique({
    where: { orderId: order.id },
    include: { order: { select: { orderNumber: true } } },
  });
  if (payment) {
    return Object.freeze({
      orderId: order.id,
      orderReference: order.orderNumber,
      amount: payment.amount.toFixed(2),
      currency: "ZAR",
      payment: toCustomerStatus(payment),
    });
  }
  const subject = await resolveOrderPaymentSubject(order.id, payer.id);
  if (!payer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) {
    throw new PaymentError("PAYFAST_PAYER_EMAIL_REQUIRED", "A valid payer email is required for Payfast checkout.");
  }
  return Object.freeze({
    orderId: order.id,
    orderReference: order.orderNumber,
    amount: subject.amount.toString(),
    currency: "ZAR",
    payment: null,
  });
}
