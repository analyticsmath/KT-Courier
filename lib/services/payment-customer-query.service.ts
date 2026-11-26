import { prisma } from "@/lib/db/prisma";
import { membershipAllows } from "@/lib/client-platform/store-permissions";
import type {
  CustomerPaymentPageDto,
  CustomerPaymentStatusDto,
} from "@/lib/dto/payment.dto";
import { PaymentError } from "@/lib/payments/errors";
import { resolveOrderPaymentSubject } from "./payment-subject.service";

async function assertStoreOrderPaymentVisibility(
  payerId: string,
  orderStoreId: string,
  explicitStoreId?: string | null,
): Promise<void> {
  const normalizedExplicit = explicitStoreId?.trim() || null;
  if (normalizedExplicit && normalizedExplicit !== orderStoreId) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Payment does not belong to the selected store workspace.",
    );
  }
  const db = prisma as unknown as {
    store?: { findMany?: typeof prisma.store.findMany };
    storeEmployeeMembership?: { findMany?: typeof prisma.storeEmployeeMembership.findMany };
  };
  if (typeof db.store?.findMany !== "function" || typeof db.storeEmployeeMembership?.findMany !== "function") {
    return;
  }
  const [ownedStores, activeMemberships] = await Promise.all([
    db.store.findMany({
      where: { ownerUserId: payerId, status: { notIn: ["SUSPENDED", "DISABLED"] } },
      select: { id: true },
    }),
    db.storeEmployeeMembership.findMany({
      where: { userId: payerId, status: "ACTIVE", store: { status: "ACTIVE" } },
      select: { storeId: true, permissions: true },
    }),
  ]);
  const ownsTarget = ownedStores.some((s) => s.id === orderStoreId);
  const hasFinance = activeMemberships.some(
    (m) => m.storeId === orderStoreId && membershipAllows(m.permissions, "finance"),
  );
  if (!ownsTarget && !hasFinance) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Payment is not available for this payer.",
    );
  }
  const allActorStores = new Set<string>([
    ...ownedStores.map((s) => s.id),
    ...activeMemberships.map((m) => m.storeId),
  ]);
  if (!normalizedExplicit && allActorStores.size > 1) {
    throw new PaymentError(
      "STORE_CONTEXT_AMBIGUOUS",
      "Select a store workspace before continuing.",
    );
  }
}

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
  explicitStoreId?: string | null,
): Promise<CustomerPaymentStatusDto | null> {
  const normalizedExplicit = explicitStoreId?.trim() || null;
  if (!normalizedExplicit) {
    const payment = await prisma.payment.findFirst({
      where: { publicReference, userId: payerId },
      include: { order: { select: { id: true, orderNumber: true, storeId: true } } },
    });
    if (!payment?.order) return null;
    if (payment.order.storeId) {
      await assertStoreOrderPaymentVisibility(payerId, payment.order.storeId, null);
    }
    return toCustomerStatus(payment);
  }

  const payment = await prisma.payment.findFirst({
    where: {
      publicReference,
      order: { storeId: normalizedExplicit },
      OR: [
        { order: { store: { ownerUserId: payerId, status: { notIn: ["SUSPENDED", "DISABLED"] } } } },
        {
          order: {
            store: {
              status: "ACTIVE",
              employeeMemberships: {
                some: {
                  userId: payerId,
                  status: "ACTIVE",
                  permissions: { array_contains: ["finance"] },
                },
              },
            },
          },
        },
      ],
    },
    include: { order: { select: { id: true, orderNumber: true, storeId: true } } },
  });
  if (!payment?.order?.storeId) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Customer parcel payment does not belong to a store workspace.",
    );
  }
  await assertStoreOrderPaymentVisibility(payerId, payment.order.storeId, normalizedExplicit);
  return toCustomerStatus(payment);
}

export async function getOwnedPaymentIdentity(
  payerId: string,
  publicReference: string,
  explicitStoreId?: string | null,
): Promise<Readonly<{
  id: string;
  publicReference: string;
  status: string;
  currentAttemptReference: string | null;
  currentActionType: string | null;
  currentRedirectUrl: string | null;
}> | null> {
  const payment = await prisma.payment.findFirst({
    where: {
      publicReference,
      OR: [
        { userId: payerId, order: { storeId: null } },
        { userId: payerId, orderId: null },
        { order: { store: { ownerUserId: payerId, status: { notIn: ["SUSPENDED", "DISABLED"] } } } },
        {
          order: {
            store: {
              status: "ACTIVE",
              employeeMemberships: {
                some: {
                  userId: payerId,
                  status: "ACTIVE",
                  permissions: { array_contains: ["finance"] },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      publicReference: true,
      status: true,
      order: { select: { storeId: true } },
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
  if (!payment) return null;
  if (payment.order?.storeId) {
    await assertStoreOrderPaymentVisibility(payerId, payment.order.storeId, explicitStoreId);
  } else if (explicitStoreId?.trim()) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Customer parcel payment does not belong to a store workspace.",
    );
  }
  return Object.freeze({
    id: payment.id,
    publicReference: payment.publicReference,
    status: payment.status,
    currentAttemptReference: payment.attempts[0]?.publicReference ?? null,
    currentActionType: payment.attempts[0]?.checkoutActionType ?? null,
    currentRedirectUrl: payment.attempts[0]?.redirectUrl ?? null,
  });
}

export async function getCustomerPaymentPage(
  payer: Readonly<{ id: string; email: string }>,
  orderReference: string,
  explicitStoreId?: string | null,
): Promise<CustomerPaymentPageDto | null> {
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: orderReference,
      OR: [
        { storeId: null, customerId: payer.id },
        { store: { ownerUserId: payer.id, status: { notIn: ["SUSPENDED", "DISABLED"] } } },
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
      storeId: true,
      priceEstimate: true,
      isQaAcceptance: true,
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
  if (order.storeId) {
    await assertStoreOrderPaymentVisibility(payer.id, order.storeId, explicitStoreId);
  }
  const payment = await prisma.payment.findUnique({
    where: { orderId: order.id },
    include: { order: { select: { orderNumber: true } } },
  });
  if (payment) {
    const isStoreAuthorized = Boolean(order.storeId);
    const canCheckout = isStoreAuthorized || payment.userId === payer.id;
    return Object.freeze({
      orderId: order.id,
      orderReference: order.orderNumber,
      isQaAcceptance: order.isQaAcceptance,
      amount: payment.amount.toFixed(2),
      canCheckout,
      checkoutBlockReason: !canCheckout
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
      isQaAcceptance: order.isQaAcceptance,
      amount: "0.00",
      currency: "ZAR",
      payment: null,
      canCheckout: false,
      checkoutBlockReason: `This delivery requires R ${order.cashOnDelivery.cashObligation.toFixed(2)} cash on delivery. No online payment is required.`,
    });
  let subject;
  try {
    subject = await resolveOrderPaymentSubject(order.id, payer.id, prisma, {
      explicitStoreId,
    });
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
        isQaAcceptance: order.isQaAcceptance,
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
      "PAYMENT_PAYER_EMAIL_REQUIRED",
      "A valid payer email is required for card checkout.",
    );
  }
  return Object.freeze({
    orderId: order.id,
    orderReference: order.orderNumber,
    isQaAcceptance: order.isQaAcceptance,
    amount: subject.amount.toString(),
    currency: "ZAR",
    payment: null,
  });
}
