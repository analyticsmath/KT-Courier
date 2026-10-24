import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { OrderTransitionError } from "@/lib/orders/order-state-machine";

export type CourierPaymentState =
  | "PAID"
  | "DEPOSIT_PAID_CASH_DUE"
  | "CASH_DUE_ON_DELIVERY"
  | "PAYMENT_REQUIRED"
  | "RECONCILIATION_REQUIRED"
  | "UNKNOWN";

export type CourierPaymentReadiness = Readonly<{
  status: CourierPaymentState;
  dispatchEligible: boolean;
  paymentReference: string | null;
  amount: string | null;
  cashDue: string | null;
}>;

type PaymentEvidence = {
  publicReference: string;
  status: string;
  amount: { toFixed(n: number): string };
  successLedgerJournalId: string | null;
};
type CodEvidence = {
  policyMode: string;
  digitalRequired: { toNumber(): number };
  cashObligation: { toFixed(n: number): string };
};
type CourierOrderPaymentEvidence = {
  payments: readonly PaymentEvidence[];
  cashOnDelivery: CodEvidence | null;
  marketplaceStoreOrderBridge: {
    storeOrder: { marketplaceOrder: { payment: PaymentEvidence } };
  } | null;
};

const empty = (status: CourierPaymentState): CourierPaymentReadiness =>
  Object.freeze({ status, dispatchEligible: false, paymentReference: null, amount: null, cashDue: null });

/** Checkout return and provider success flags alone do not release goods. */
export function classifyCourierPayment(evidence: CourierOrderPaymentEvidence): CourierPaymentReadiness {
  const cod = evidence.cashOnDelivery;
  const cashDue = cod ? cod.cashObligation.toFixed(2) : null;
  const payment = evidence.payments[0] ?? evidence.marketplaceStoreOrderBridge?.storeOrder.marketplaceOrder.payment ?? null;
  if (cod?.policyMode === "FULL_COD" && cod.digitalRequired.toNumber() === 0) {
    return Object.freeze({ status: "CASH_DUE_ON_DELIVERY", dispatchEligible: true, paymentReference: null, amount: null, cashDue });
  }
  if (payment?.status === "SUCCEEDED" && payment.successLedgerJournalId) {
    const depositOnly = cod?.policyMode === "DEPOSIT_PLUS_COD" && Number(cashDue) > 0;
    return Object.freeze({ status: depositOnly ? "DEPOSIT_PAID_CASH_DUE" : "PAID", dispatchEligible: true, paymentReference: payment.publicReference, amount: payment.amount.toFixed(2), cashDue });
  }
  if (payment?.status === "SUCCEEDED" && !payment.successLedgerJournalId) {
    return Object.freeze({ ...empty("RECONCILIATION_REQUIRED"), paymentReference: payment.publicReference, amount: payment.amount.toFixed(2), cashDue });
  }
  return Object.freeze({ ...empty("PAYMENT_REQUIRED"), paymentReference: payment?.publicReference ?? null, amount: payment?.amount.toFixed(2) ?? null, cashDue });
}

const financialPaymentSelect = {
  publicReference: true,
  status: true,
  amount: true,
  successLedgerJournalId: true,
} as const;

/** One bounded, ownership-independent admin/dispatch read from canonical order and payment links. */
export async function listCourierPaymentReadiness(
  orderIds: readonly string[],
  db: Pick<Prisma.TransactionClient, "order"> = prisma,
): Promise<Map<string, CourierPaymentReadiness>> {
  if (!orderIds.length) return new Map();
  const orders = await db.order.findMany({
    where: { id: { in: [...new Set(orderIds)] } },
    select: {
      id: true,
      cashOnDelivery: {
        select: { policyMode: true, digitalRequired: true, cashObligation: true },
      },
      payments: {
        where: { subjectType: "COURIER_ORDER" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: financialPaymentSelect,
      },
      marketplaceStoreOrderBridge: {
        select: {
          storeOrder: {
            select: {
              marketplaceOrder: { select: { payment: { select: financialPaymentSelect } } },
            },
          },
        },
      },
    },
  });
  const byId = new Map(orders.map((order) => [order.id, classifyCourierPayment(order)]));
  return new Map(orderIds.map((id) => [id, byId.get(id) ?? empty("UNKNOWN")]));
}

export async function getCourierPaymentReadiness(
  orderId: string,
  db: Pick<Prisma.TransactionClient, "order"> = prisma,
): Promise<CourierPaymentReadiness> {
  const states = await listCourierPaymentReadiness([orderId], db);
  return states.get(orderId) ?? empty("UNKNOWN");
}

/** Admin overrides cannot create pickup, custody or delivery without money.
 * Booking confirmation/cancellation remain available for payment follow-up. */
export function requirePaymentBeforeCourierProgress(
  toStatus: string,
  readiness: Pick<CourierPaymentReadiness, "dispatchEligible" | "status">,
): void {
  if (!["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "IN_PROGRESS", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"].includes(toStatus)) return;
  if (!readiness.dispatchEligible) {
    throw new OrderTransitionError(
      "Digital payment is not ledger-confirmed. Courier fulfilment cannot advance.",
      "FORBIDDEN",
    );
  }
}
