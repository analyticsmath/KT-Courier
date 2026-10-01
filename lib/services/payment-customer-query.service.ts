import { prisma } from "@/lib/db/prisma";
import type {
  CustomerPaymentPageDto,
  CustomerPaymentStatusDto,
} from "@/lib/dto/payment.dto";
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
    throw new PaymentError(
      "PAYMENT_ORDER_NOT_FOUND",
      "Payment order relationship is incomplete.",
    );
  }
  return Object.freeze({
    publicReference: payment.publicReference,
    orderReference: payment.order.orderNumber,
    amount: payment.amount.toFixed(2),
    currency: "ZAR",
    provider:
      payment.provider === "PAYSTACK" || payment.provider === "PAYFAST"
        ? payment.provider
        : null,
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
  currentRedirectUrl: string | null;
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
        select: {
          publicReference: true,
          checkoutActionType: true,
          redirectUrl: true,
        },
      },
    },
  });
  return payment
    ? Object.freeze({
        id: payment.id,
        publicReference: payment.publicReference,
        status: payment.status,
        currentAttemptReference: payment.attempts[0]?.publicReference ?? null,
        currentActionType: payment.attempts[0]?.checkoutActionType ?? null,
        currentRedirectUrl: payment.attempts[0]?.redirectUrl ?? null,
      })
    : null;
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
        {
          store: {
            status: "ACTIVE",
            employeeMemberships: {
              some: {
                userId: payer.id,
                status: "ACTIVE",
                permissions: { array_contains: ["finance"] },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      priceEstimate: true,
      cashOnDelivery: {
        select: {
          policyMode: true,
          cashObligation: true,
          digitalRequired: true,
        },
      },
    },
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
      canCheckout: payment.userId === payer.id,
      checkoutBlockReason:
        payment.userId !== payer.id
          ? "This payment was prepared by another authorized payer. They can continue checkout from their own account."
          : undefined,
      currency: "ZAR",
      payment: toCustomerStatus(payment),
    });
  }
  if (order.cashOnDelivery?.policyMode === "FULL_COD")
    return Object.freeze({
      orderId: order.id,
      orderReference: order.orderNumber,
      amount: "0.00",
      currency: "ZAR",
      payment: null,
      canCheckout: false,
      checkoutBlockReason: `This delivery requires R ${order.cashOnDelivery.cashObligation.toFixed(2)} cash on delivery. No online payment is required.`,
    });
  let subject;
  try {
    subject = await resolveOrderPaymentSubject(order.id, payer.id);
  } catch (error) {
    if (
      error instanceof PaymentError &&
      ["PAYMENT_ORDER_NOT_PAYABLE", "PAYMENT_ORDER_ALREADY_PAID"].includes(
        error.code,
      )
    )
      return Object.freeze({
        orderId: order.id,
        orderReference: order.orderNumber,
        amount: order.priceEstimate?.toFixed(2) ?? "0.00",
        currency: "ZAR",
        payment: null,
        canCheckout: false,
        checkoutBlockReason:
          "This delivery is not currently available for online payment. Contact KT support if you need help.",
      });
    throw error;
  }
  if (!payer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) {
    throw new PaymentError(
      "PAYFAST_PAYER_EMAIL_REQUIRED",
      "A valid payer email is required for Payfast checkout.",
    );
  }
  return Object.freeze({
    orderId: order.id,
    orderReference: order.orderNumber,
    amount: subject.amount.toString(),
    currency: "ZAR",
    payment: null,
  });
}
