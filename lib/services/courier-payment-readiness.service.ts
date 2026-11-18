import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { OrderTransitionError } from "@/lib/orders/order-state-machine";
import { isHighRiskCashPolicyEvidence } from "@/lib/settings/high-risk-region-policy";

export type CourierPaymentState =
  | "PAID"
  | "DEPOSIT_PAID_CASH_DUE"
  | "CASH_DUE_ON_DELIVERY"
  | "CASH_COLLECTED"
  | "CASH_RECONCILED"
  | "PAYMENT_REQUIRED"
  | "RECONCILIATION_REQUIRED"
  | "UNKNOWN";

export type CourierPaymentReasonCode =
  | "PAYMENT_PENDING"
  | "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"
  | "COD_POLICY_NOT_ACTIVE"
  | "COD_DEPOSIT_PENDING"
  | "CASH_RISK_RESTRICTED"
  | "UNKNOWN";

export type CourierPaymentReadiness = Readonly<{
  status: CourierPaymentState;
  dispatchEligible: boolean;
  paymentReference: string | null;
  amount: string | null;
  cashDue: string | null;
  reasonCode: CourierPaymentReasonCode | null;
  reasonMessage: string;
}>;

type PaymentEvidence = {
  id?: string;
  metadata?: unknown;
  publicReference: string;
  status: string;
  amount: { toFixed(n: number): string };
  successLedgerJournalId: string | null;
  reconciliationStatus?: string | null;
};
type CodEvidence = {
  paymentId?: string | null;
  digitalPaid?: { toFixed(n: number): string };
  events?: readonly { safeEvidence: unknown }[];
  policyMode: string;
  digitalRequired: { toNumber(): number };
  cashObligation: { toFixed(n: number): string };
  cashCollected?: { toFixed(n: number): string };
  status?: string;
};
type CourierOrderPaymentEvidence = {
  pricingSnapshot?: unknown;
  payments: readonly PaymentEvidence[];
  cashOnDelivery: CodEvidence | null;
  marketplaceStoreOrderBridge: {
    storeOrder: { marketplaceOrder: { payment: PaymentEvidence } };
  } | null;
};

const READINESS_REASON_MESSAGES: Readonly<Record<CourierPaymentReasonCode, string>> = {
  PAYMENT_PENDING:
    "Digital payment has not been verified and posted to the financial ledger. Cannot accept or advance courier fulfilment.",
  PAYMENT_LEDGER_RECONCILIATION_REQUIRED:
    "Payment verification or financial ledger reconciliation is incomplete. Resolve financial reconciliation before accepting or advancing fulfilment.",
  COD_POLICY_NOT_ACTIVE:
    "Cash-on-delivery authorization is not active for this parcel order.",
  COD_DEPOSIT_PENDING:
    "Approved 50% digital deposit payment is not verified in the financial ledger. Parcel cannot be accepted or dispatched until the deposit is confirmed.",
  CASH_RISK_RESTRICTED:
    "Cash payment is excluded for a high-risk pickup or drop-off locality.",
  UNKNOWN:
    "Order payment readiness cannot be verified.",
};

const empty = (
  status: CourierPaymentState,
  reasonCode: CourierPaymentReasonCode | null = status === "UNKNOWN"
    ? "UNKNOWN"
    : status === "RECONCILIATION_REQUIRED"
      ? "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"
      : status === "PAYMENT_REQUIRED"
        ? "PAYMENT_PENDING"
        : null,
  reasonMessage?: string,
): CourierPaymentReadiness =>
  Object.freeze({
    status,
    dispatchEligible: false,
    paymentReference: null,
    amount: null,
    cashDue: null,
    reasonCode,
    reasonMessage:
      reasonMessage ??
      (reasonCode ? READINESS_REASON_MESSAGES[reasonCode] : "Payment verification status recorded."),
  });

function hasHighRiskSnapshot(evidence: CourierOrderPaymentEvidence): boolean {
  const codEvidence = evidence.cashOnDelivery?.events?.[0]?.safeEvidence;
  if (isHighRiskCashPolicyEvidence(codEvidence)) return true;
  if (
    evidence.pricingSnapshot &&
    typeof evidence.pricingSnapshot === "object" &&
    !Array.isArray(evidence.pricingSnapshot)
  ) {
    const policy = (evidence.pricingSnapshot as Record<string, unknown>).paymentPolicy;
    if (isHighRiskCashPolicyEvidence(policy)) return true;
  }
  return false;
}

/** Checkout return and provider success flags alone do not release goods. */
export function classifyCourierPayment(evidence: CourierOrderPaymentEvidence): CourierPaymentReadiness {
  const cod = evidence.cashOnDelivery;
  const cashDue = cod ? cod.cashObligation.toFixed(2) : null;
  const payment = evidence.payments[0] ?? evidence.marketplaceStoreOrderBridge?.storeOrder.marketplaceOrder.payment ?? null;
  // A posted receipt still must not release custody while its payment is
  // explicitly held for financial reconciliation.
  if (payment?.reconciliationStatus === "REQUIRED") {
    return Object.freeze({
      ...empty("RECONCILIATION_REQUIRED", "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"),
      paymentReference: payment.publicReference,
      amount: payment.amount.toFixed(2),
      cashDue,
    });
  }
  if (cod?.policyMode === "FULL_COD" && cod.digitalRequired.toNumber() === 0) {
    if (hasHighRiskSnapshot(evidence)) {
      return Object.freeze({
        ...empty("PAYMENT_REQUIRED", "CASH_RISK_RESTRICTED"),
        cashDue,
      });
    }
    const collected = new Prisma.Decimal(cod.cashCollected?.toFixed(2) ?? "0.00");
    const obligation = new Prisma.Decimal(cod.cashObligation.toFixed(2));
    const outstanding = obligation.sub(collected);
    // Only a committed, collectible obligation may authorize dispatch.
    // A failed collection or a pending/malformed cash obligation is never a
    // reason to release a parcel for delivery again.
    if (obligation.lessThanOrEqualTo(0) || collected.isNegative() || outstanding.isNegative()) {
      return empty("RECONCILIATION_REQUIRED", "PAYMENT_LEDGER_RECONCILIATION_REQUIRED");
    }
    if (cod.status === "READY_FOR_COLLECTION" && collected.isZero()) {
      return Object.freeze({
        status: "CASH_DUE_ON_DELIVERY",
        dispatchEligible: true,
        paymentReference: null,
        amount: null,
        cashDue: outstanding.toFixed(2),
        reasonCode: null,
        reasonMessage: "Approved full cash-on-delivery obligation; cash balance due on delivery.",
      });
    }
    if (outstanding.isZero() && ["COLLECTED", "RECONCILED", "UNDER_RECONCILIATION"].includes(cod.status ?? "")) {
      return Object.freeze({
        status: cod.status === "RECONCILED" ? "CASH_RECONCILED" : "CASH_COLLECTED",
        dispatchEligible: true,
        paymentReference: null,
        amount: collected.toFixed(2),
        cashDue: "0.00",
        reasonCode: null,
        reasonMessage:
          cod.status === "RECONCILED"
            ? "Cash-on-delivery collection reconciled to verified bank remittance."
            : "Cash-on-delivery collected; bank remittance reconciliation pending.",
      });
    }
    if (cod.status === "PENDING") {
      return empty(
        "RECONCILIATION_REQUIRED",
        "COD_POLICY_NOT_ACTIVE",
        READINESS_REASON_MESSAGES.COD_POLICY_NOT_ACTIVE,
      );
    }
    return empty("RECONCILIATION_REQUIRED", "PAYMENT_LEDGER_RECONCILIATION_REQUIRED");
  }
  if (payment?.status === "SUCCEEDED" && payment.successLedgerJournalId) {
    const depositOnly = cod?.policyMode === "DEPOSIT_PLUS_COD";
    if (depositOnly) {
      // A provider success alone cannot activate a deposit-backed COD order.
      // For a wallet split, the exact consumed wallet journal must already be
      // embedded in the COD deposit event by the canonical money transaction.
      const required = new Prisma.Decimal(cod.digitalRequired.toNumber());
      const funded = new Prisma.Decimal(cod.digitalPaid?.toFixed(2) ?? "0.00");
      const provider = new Prisma.Decimal(payment.amount.toFixed(2));
      const outstanding = new Prisma.Decimal(cod.cashObligation.toFixed(2));
      const meta = payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
        ? payment.metadata as Record<string, unknown>
        : {};
      const split = meta.walletSplit === true;
      const deposited = cod.events?.[0]?.safeEvidence;
      const depositEvidence = deposited && typeof deposited === "object" && !Array.isArray(deposited)
        ? deposited as Record<string, unknown>
        : {};
      const walletAmount = split && typeof meta.walletAmount === "string" &&
        /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(meta.walletAmount)
        ? new Prisma.Decimal(meta.walletAmount)
        : new Prisma.Decimal(0);
      const splitMatches = split
        ? walletAmount.greaterThan(0) &&
          provider.add(walletAmount).equals(required) &&
          typeof depositEvidence.walletJournalId === "string" &&
          depositEvidence.walletJournalId.length > 0 &&
          depositEvidence.walletAmount === walletAmount.toFixed(2) &&
          depositEvidence.providerAmount === provider.toFixed(2)
        : provider.equals(required);
      if (
        cod.status !== "READY_FOR_COLLECTION" ||
        !cod.paymentId || !payment.id || cod.paymentId !== payment.id ||
        !required.isFinite() || required.lessThanOrEqualTo(0) ||
        !funded.equals(required) || outstanding.lessThanOrEqualTo(0) ||
        !splitMatches
      ) {
        return Object.freeze({
          ...empty("RECONCILIATION_REQUIRED", "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"),
          paymentReference: payment.publicReference,
          amount: payment.amount.toFixed(2),
          cashDue,
        });
      }
    }
    return Object.freeze({
      status: depositOnly ? "DEPOSIT_PAID_CASH_DUE" : "PAID",
      dispatchEligible: true,
      paymentReference: payment.publicReference,
      amount: payment.amount.toFixed(2),
      cashDue,
      reasonCode: null,
      reasonMessage: depositOnly
        ? "Approved 50% digital deposit verified in ledger; remaining cash balance due on delivery."
        : "Verified digital payment and immutable ledger receipt recorded.",
    });
  }
  if (payment?.status === "SUCCEEDED" && !payment.successLedgerJournalId) {
    return Object.freeze({
      ...empty("RECONCILIATION_REQUIRED", "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"),
      paymentReference: payment.publicReference,
      amount: payment.amount.toFixed(2),
      cashDue,
    });
  }
  if (cod?.policyMode === "DEPOSIT_PLUS_COD") {
    return Object.freeze({
      ...empty("PAYMENT_REQUIRED", hasHighRiskSnapshot(evidence) ? "CASH_RISK_RESTRICTED" : "COD_DEPOSIT_PENDING"),
      paymentReference: payment?.publicReference ?? null,
      amount: payment?.amount.toFixed(2) ?? null,
      cashDue,
    });
  }
  return Object.freeze({
    ...empty("PAYMENT_REQUIRED", hasHighRiskSnapshot(evidence) ? "CASH_RISK_RESTRICTED" : "PAYMENT_PENDING"),
    paymentReference: payment?.publicReference ?? null,
    amount: payment?.amount.toFixed(2) ?? null,
    cashDue,
  });
}

const financialPaymentSelect = {
  id: true,
  metadata: true,
  publicReference: true,
  status: true,
  amount: true,
  successLedgerJournalId: true,
  reconciliationStatus: true,
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
      pricingSnapshot: true,
      cashOnDelivery: {
        select: {
          paymentId: true,
          policyMode: true, digitalRequired: true, digitalPaid: true, cashObligation: true, cashCollected: true, status: true,
          events: {
            where: { eventType: { in: ["DEPOSIT_VERIFIED", "COMMITTED"] } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: { safeEvidence: true },
          },
        },
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
  return new Map(orderIds.map((id) => [id, byId.get(id) ?? empty("UNKNOWN", "UNKNOWN")]));
}

export async function getCourierPaymentReadiness(
  orderId: string,
  db: Pick<Prisma.TransactionClient, "order"> = prisma,
): Promise<CourierPaymentReadiness> {
  const states = await listCourierPaymentReadiness([orderId], db);
  return states.get(orderId) ?? empty("UNKNOWN", "UNKNOWN");
}

export const COURIER_PAYMENT_GATED_STATUSES = [
  "CONFIRMED",
  "PICKUP_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "IN_PROGRESS",
  "DELIVERY_ATTEMPTED",
  "DELIVERED",
  "COMPLETED",
] as const;

export function isCourierProgressStatus(status: string): boolean {
  return (COURIER_PAYMENT_GATED_STATUSES as readonly string[]).includes(status);
}

/**
 * Central acceptance & fulfilment payment gate.
 * Admin overrides cannot accept/confirm or advance unpaid digital or deposit-COD bookings.
 * Cancellation/failure remain available without funding.
 */
export function requirePaymentBeforeCourierProgress(
  toStatus: string,
  readiness: Pick<CourierPaymentReadiness, "dispatchEligible" | "status"> &
    Partial<Pick<CourierPaymentReadiness, "reasonCode" | "reasonMessage">>,
): void {
  if (!isCourierProgressStatus(toStatus)) return;
  if (!readiness.dispatchEligible) {
    const fallbackCode: CourierPaymentReasonCode =
      readiness.status === "RECONCILIATION_REQUIRED"
        ? "PAYMENT_LEDGER_RECONCILIATION_REQUIRED"
        : readiness.status === "UNKNOWN"
          ? "UNKNOWN"
          : "PAYMENT_PENDING";
    const reasonCode = readiness.reasonCode ?? fallbackCode;
    const message =
      readiness.reasonMessage?.trim() ||
      READINESS_REASON_MESSAGES[reasonCode];
    throw new OrderTransitionError(message, "FORBIDDEN", reasonCode);
  }
}

export async function assertCourierOrderTransitionFundingInTx(
  tx: Pick<Prisma.TransactionClient, "order">,
  orderId: string,
  toStatus: string,
): Promise<CourierPaymentReadiness | null> {
  if (!isCourierProgressStatus(toStatus)) return null;
  const readiness = await getCourierPaymentReadiness(orderId, tx);
  requirePaymentBeforeCourierProgress(toStatus, readiness);
  return readiness;
}
