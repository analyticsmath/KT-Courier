import { Prisma } from "@prisma/client";
import { isHighRiskCashPolicyEvidence } from "@/lib/settings/high-risk-region-policy";

type SplitDbClient = Pick<
  Prisma.TransactionClient,
  "order" | "cashOnDelivery" | "payment" | "ledgerJournal"
>;

export type CourierPaymentSplitSummary = Readonly<{
  mode: "DIGITAL_ONLY" | "FULL_COD" | "DEPOSIT_PLUS_COD";
  orderNumber: string;
  paymentReference: string | null;
  totalZar: string;
  depositPaidZar: string;
  walletPaidZar: string;
  providerPaidZar: string;
  cashDueZar: string;
  paymentConfirmedTitle: string;
  paymentConfirmedBody: string;
  acceptanceTitle: string;
  acceptanceBody: string;
  adminPaidTitle: string;
  adminPaidSummary: string;
  adminAcceptedSummary: string;
}>;

function isValidSplitAmount(value: unknown): value is string {
  return (
    typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)
  );
}

/**
 * Single authoritative builder for customer and admin payment/acceptance copy.
 * All monetary figures are derived exclusively from persisted database records
 * (`Order`, `CashOnDelivery`, `Payment`, and `LedgerJournal`), never caller input.
 */
export async function describeCourierOrderPaymentSplitFromDb(
  db: SplitDbClient,
  orderId: string,
  paymentReference?: string | null,
): Promise<CourierPaymentSplitSummary | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      priceEstimate: true,
      pricingSnapshot: true,
      cashOnDelivery: {
        select: {
          policyMode: true,
          status: true,
          authoritativePayable: true,
          digitalRequired: true,
          digitalPaid: true,
          cashObligation: true,
          events: {
            take: 5,
            orderBy: { createdAt: "asc" },
            select: { eventType: true, safeEvidence: true },
          },
        },
      },
      payments: {
        where: {
          subjectType: "COURIER_ORDER",
          status: "SUCCEEDED",
          successLedgerJournalId: { not: null },
        },
        orderBy: [{ succeededAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          publicReference: true,
          provider: true,
          amount: true,
          metadata: true,
          successLedgerJournalId: true,
        },
      },
    },
  });

  if (!order) return null;

  const cod = order.cashOnDelivery;
  const payment = paymentReference
    ? order.payments.find((p) => p.publicReference === paymentReference) ??
      order.payments[0]
    : order.payments[0];

  if (cod?.policyMode === "FULL_COD") {
    const pricingPolicy =
      order.pricingSnapshot &&
      typeof order.pricingSnapshot === "object" &&
      !Array.isArray(order.pricingSnapshot)
        ? (order.pricingSnapshot as Record<string, unknown>).paymentPolicy
        : null;
    if (
      isHighRiskCashPolicyEvidence(pricingPolicy) ||
      cod.events.some((ev) => isHighRiskCashPolicyEvidence(ev.safeEvidence)) ||
      cod.status === "CANCELLED"
    ) {
      throw new Error("HIGH_RISK_OR_CANCELLED_COD");
    }

    const totalZar = cod.authoritativePayable.toFixed(2);
    const cashDueZar = cod.cashObligation.toFixed(2);
    const acceptanceBody = `Your parcel order ${order.orderNumber} has been accepted under approved cash-on-delivery terms and is ready for driver dispatch. R${cashDueZar} cash is due to the driver at delivery.`;

    return Object.freeze({
      mode: "FULL_COD",
      orderNumber: order.orderNumber,
      paymentReference: null,
      totalZar,
      depositPaidZar: "0.00",
      walletPaidZar: "0.00",
      providerPaidZar: "0.00",
      cashDueZar,
      paymentConfirmedTitle: `KT Couriers: cash terms recorded for ${order.orderNumber}`,
      paymentConfirmedBody: acceptanceBody,
      acceptanceTitle: `KT Couriers: order ${order.orderNumber} accepted (R${cashDueZar} cash on delivery)`,
      acceptanceBody,
      adminPaidTitle: `Full COD order ${order.orderNumber} (R${cashDueZar} cash due)`,
      adminPaidSummary: `Full COD parcel ${order.orderNumber} accepted under approved cash terms. R${cashDueZar} cash due on delivery.`,
      adminAcceptedSummary: `Approved full COD parcel ${order.orderNumber} moved to CONFIRMED; R${cashDueZar} cash due to driver at delivery.`,
    });
  }

  let walletPaid = new Prisma.Decimal(0);
  let providerPaid = new Prisma.Decimal(0);

  if (payment) {
    const meta =
      payment.metadata &&
      typeof payment.metadata === "object" &&
      !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};
    if (meta.walletSettled === true && isValidSplitAmount(meta.walletAmount)) {
      walletPaid = new Prisma.Decimal(meta.walletAmount);
    } else if (
      meta.walletSplit === true &&
      isValidSplitAmount(meta.walletAmount)
    ) {
      walletPaid = new Prisma.Decimal(meta.walletAmount);
      providerPaid = payment.amount;
    } else {
      providerPaid = payment.amount;
    }
  }

  const totalDigitallyVerified = walletPaid.add(providerPaid);

  if (cod?.policyMode === "DEPOSIT_PLUS_COD") {
    const cashDue = cod.cashObligation;
    const depositPaid = cod.digitalPaid.greaterThan(0)
      ? cod.digitalPaid
      : totalDigitallyVerified;
    const cashDueZar = cashDue.toFixed(2);
    const depositPaidZar = depositPaid.toFixed(2);
    const totalZar = cod.authoritativePayable.toFixed(2);

    const breakdownNote =
      walletPaid.greaterThan(0) && providerPaid.greaterThan(0)
        ? ` (R${walletPaid.toFixed(2)} wallet + R${providerPaid.toFixed(2)} online)`
        : walletPaid.greaterThan(0) && providerPaid.isZero()
          ? " via wallet balance"
          : " in the financial ledger";

    const paymentConfirmedBody = `Your R${depositPaidZar} deposit${breakdownNote} for parcel order ${order.orderNumber} was verified. R${cashDueZar} cash is due to the driver at delivery.`;
    const acceptanceBody = `Your parcel order ${order.orderNumber} is accepted with your verified R${depositPaidZar} deposit and is ready for driver dispatch. R${cashDueZar} cash is due to the driver at delivery.`;

    return Object.freeze({
      mode: "DEPOSIT_PLUS_COD",
      orderNumber: order.orderNumber,
      paymentReference: payment?.publicReference ?? paymentReference ?? null,
      totalZar,
      depositPaidZar,
      walletPaidZar: walletPaid.toFixed(2),
      providerPaidZar: providerPaid.toFixed(2),
      cashDueZar,
      paymentConfirmedTitle: `KT Couriers: R${depositPaidZar} deposit confirmed for ${order.orderNumber} (R${cashDueZar} cash due)`,
      paymentConfirmedBody,
      acceptanceTitle: `KT Couriers: order ${order.orderNumber} accepted (R${cashDueZar} cash due)`,
      acceptanceBody,
      adminPaidTitle: `Parcel deposit verified (${order.orderNumber}: R${depositPaidZar} paid, R${cashDueZar} cash due)`,
      adminPaidSummary: `50/50 COD deposit R${depositPaidZar} verified${breakdownNote} (ref ${payment?.publicReference ?? "N/A"}). R${cashDueZar} cash due on delivery.`,
      adminAcceptedSummary: `50/50 COD parcel ${order.orderNumber} accepted after R${depositPaidZar} deposit (${payment?.publicReference ?? "N/A"}); R${cashDueZar} cash due on delivery.`,
    });
  }

  const paidZar = totalDigitallyVerified.greaterThan(0)
    ? totalDigitallyVerified.toFixed(2)
    : (order.priceEstimate ?? new Prisma.Decimal(0)).toFixed(2);

  const digitalBreakdown =
    walletPaid.greaterThan(0) && providerPaid.greaterThan(0)
      ? ` (R${walletPaid.toFixed(2)} wallet + R${providerPaid.toFixed(2)} online)`
      : "";

  const payRefLabel = payment?.publicReference ?? order.orderNumber;
  return Object.freeze({
    mode: "DIGITAL_ONLY",
    orderNumber: order.orderNumber,
    paymentReference: payment?.publicReference ?? paymentReference ?? null,
    totalZar: paidZar,
    depositPaidZar: paidZar,
    walletPaidZar: walletPaid.toFixed(2),
    providerPaidZar: providerPaid.toFixed(2),
    cashDueZar: "0.00",
    paymentConfirmedTitle: `KT Couriers: payment confirmed for ${order.orderNumber}`,
    paymentConfirmedBody: `Full digital payment of R${paidZar}${digitalBreakdown} for parcel order ${order.orderNumber} has been verified and recorded in the financial ledger.`,
    acceptanceTitle: `KT Couriers: order ${order.orderNumber} accepted`,
    acceptanceBody: `Your parcel order ${order.orderNumber} has full verified digital payment (R${paidZar}) and is accepted for driver dispatch. Check your KT Couriers account for live progress.`,
    adminPaidTitle: `Parcel order paid (${payRefLabel})`,
    adminPaidSummary: `Verified full digital payment of R${paidZar}${digitalBreakdown} (${payRefLabel}) in ledger.`,
    adminAcceptedSummary: `Full digital payment ${payRefLabel} (R${paidZar}) verified in ledger; parcel moved to CONFIRMED.`,
  });
}
