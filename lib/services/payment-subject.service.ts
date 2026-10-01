import { storeAccess } from "@/lib/client-platform/store-access";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LedgerMoney } from "@/lib/ledger/money";
import { PaymentError } from "@/lib/payments/errors";

const PAYABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PICKUP_SCHEDULED,
]);

export type ResolvedOrderPaymentSubject = Readonly<{
  subjectType: "ORDER";
  subjectId: string;
  orderReference: string;
  payerUserId: string;
  currency: "ZAR";
  amount: LedgerMoney;
  description: string;
  paymentAllowed: true;
  existingSuccessfulPaymentId: null;
}>;

export async function resolveOrderPaymentSubject(
  orderId: string,
  payerUserId: string,
  db: Pick<Prisma.TransactionClient, "order"> = prisma,
): Promise<ResolvedOrderPaymentSubject> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      store: { select: { ownerUserId: true } },
      pricingQuote: {
        select: {
          id: true,
          currency: true,
          calculationVersion: true,
          subtotal: true,
          taxAmount: true,
          taxRate: true,
          total: true,
        },
      },
      cashOnDelivery: true,
      payments: {
        where: { status: "SUCCEEDED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!order)
    throw new PaymentError(
      "PAYMENT_ORDER_NOT_FOUND",
      "Order is not available for payment.",
    );
  const ownsCustomerOrder = order.customerId === payerUserId;
  const ownsStoreOrder = order.store?.ownerUserId === payerUserId;
  let authorizedEmployee = false;
  if (!ownsCustomerOrder && !ownsStoreOrder && order.storeId) {
    try {
      authorizedEmployee =
        (await storeAccess(payerUserId, "finance")).store.id === order.storeId;
    } catch {
      /* Business access is denied. */
    }
  }
  if (!ownsCustomerOrder && !ownsStoreOrder && !authorizedEmployee) {
    throw new PaymentError(
      "PAYMENT_PAYER_NOT_AUTHORIZED",
      "Order is not available for this payer.",
    );
  }
  if (order.payments.length > 0) {
    throw new PaymentError(
      "PAYMENT_ORDER_ALREADY_PAID",
      "Order already has a successful payment.",
    );
  }
  if (
    !PAYABLE_ORDER_STATUSES.has(order.status) ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.FAILED
  ) {
    throw new PaymentError(
      "PAYMENT_ORDER_NOT_PAYABLE",
      "Order status does not allow payment.",
    );
  }

  const quote = order.pricingQuote;
  const snapshot = order.pricingSnapshot as {
    quoteId?: unknown;
    calculationVersion?: unknown;
  } | null;
  const pricingConsistent =
    quote &&
    order.pricingQuoteId === quote.id &&
    order.priceEstimate?.equals(quote.total) &&
    order.pricingSubtotal?.equals(quote.subtotal) &&
    order.pricingTaxAmount?.equals(quote.taxAmount) &&
    order.pricingTaxRate?.equals(quote.taxRate) &&
    snapshot?.quoteId === quote.id &&
    snapshot?.calculationVersion === quote.calculationVersion;
  if (!pricingConsistent) {
    throw new PaymentError(
      "PAYMENT_ORDER_NOT_PAYABLE",
      "Order pricing evidence is incomplete or inconsistent.",
    );
  }
  if (order.currency !== "ZAR" || quote.currency !== "ZAR") {
    throw new PaymentError(
      "PAYMENT_CURRENCY_UNSUPPORTED",
      "Only ZAR order payments are supported.",
    );
  }

  const cod = order.cashOnDelivery;
  const committed = order.pricingSnapshot as {
    paymentPolicy?: {
      mode?: unknown;
      digitalRequired?: unknown;
      cashRequired?: unknown;
    };
  } | null;
  let payable = quote.total;
  if (cod) {
    const policy = committed?.paymentPolicy;
    if (
      cod.policyMode !== "DEPOSIT_PLUS_COD" ||
      cod.status !== "PENDING" ||
      !cod.digitalPaid.isZero() ||
      !cod.cashCollected.isZero() ||
      !cod.authoritativePayable.equals(quote.total) ||
      !cod.digitalRequired.add(cod.cashObligation).equals(quote.total) ||
      !cod.digitalRequired.gt(0) ||
      !cod.digitalRequired.lt(quote.total) ||
      policy?.mode !== cod.policyMode ||
      policy.digitalRequired !== cod.digitalRequired.toFixed(2) ||
      policy.cashRequired !== cod.cashObligation.toFixed(2)
    )
      throw new PaymentError(
        "PAYMENT_ORDER_NOT_PAYABLE",
        "The committed cash and online payment evidence is not payable.",
      );
    payable = cod.digitalRequired;
  } else if (
    committed?.paymentPolicy?.mode &&
    committed.paymentPolicy.mode !== "DIGITAL_ONLY"
  )
    throw new PaymentError(
      "PAYMENT_ORDER_NOT_PAYABLE",
      "Cash payment evidence is missing.",
    );
  let amount: LedgerMoney;
  try {
    amount = LedgerMoney.fromDecimal(new Prisma.Decimal(payable));
  } catch (error) {
    throw new PaymentError(
      "PAYMENT_INVALID_AMOUNT",
      "Order payable amount is invalid.",
      false,
      { cause: error },
    );
  }
  if (amount.isZero() || amount.lessThan(LedgerMoney.zero())) {
    throw new PaymentError(
      "PAYMENT_INVALID_AMOUNT",
      "Order payable amount must be greater than zero.",
    );
  }

  return Object.freeze({
    subjectType: "ORDER",
    subjectId: order.id,
    orderReference: order.orderNumber,
    payerUserId,
    currency: "ZAR",
    amount,
    description: `KT Couriers order ${order.orderNumber}`.slice(0, 160),
    paymentAllowed: true,
    existingSuccessfulPaymentId: null,
  });
}
