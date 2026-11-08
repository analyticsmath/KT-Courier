import { Prisma } from "@prisma/client";
import { isCanonicalExternalPaymentReceipt } from "@/lib/payments/canonical-external-receipt";

export type OrdinaryReferralPaymentEvidence = Readonly<{
  id: string;
  publicReference: string;
  userId: string | null;
  subjectType: string;
  purpose: string;
  provider: string | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  succeededAt: Date | null;
  providerConfirmedAt: Date | null;
  totalRefundedAmount: Prisma.Decimal;
  totalRefundReservedAmount: Prisma.Decimal;
  reconciliationStatus: string;
  disputes: readonly Readonly<{ id: string }>[];
  successfulAttempt: Readonly<{
    id: string; paymentId: string; provider: string; status: string; amount: Prisma.Decimal;
    currency: string; merchantReference: string; providerEnvironment: string | null;
  }> | null;
  successWebhookEvent: Readonly<{
    paymentId: string | null; attemptId: string | null; provider: string; environment: string;
    merchantReference: string; processingStatus: string; signatureVerified: boolean;
    sourceAddressVerified: boolean; merchantVerified: boolean; amountVerified: boolean;
    providerDataVerified: boolean; ledgerJournalId: string | null;
  }> | null;
  successLedgerJournal: Readonly<{
    id: string; type: string; currency: string; correlationId: string | null;
    totalDebits: Prisma.Decimal; totalCredits: Prisma.Decimal;
    entries: readonly Readonly<{
      direction: string; amount: Prisma.Decimal;
      account: Readonly<{ code: string; purpose: string; category: string }>;
    }>[];
  }> | null;
  order: Readonly<{
    id: string; customerId: string | null; status: string;
    cashOnDelivery: Readonly<{ cashObligation: Prisma.Decimal; status: string }> | null;
  }> | null;
  marketplaceOrder: Readonly<{
    id: string; customerUserId: string | null; status: string;
    cashRequired: Prisma.Decimal;
    storeOrders: readonly Readonly<{
      status: string; derivedStatus: string; financialResolutionStatus: string;
    }>[];
  }> | null;
}>;

export type OrdinaryReferralFinancialStatus =
  | "VERIFIED_FIRST_PAID_ORDER"
  | "INELIGIBLE_PAYMENT_OWNER"
  | "UNVERIFIED_PROVIDER_FUNDING"
  | "SANDBOX_PAYMENT"
  | "REFUND_OR_DISPUTE"
  | "INCOMPLETE_FULFILMENT";

export function verifyOrdinaryReferralPaymentEvidence(
  payment: OrdinaryReferralPaymentEvidence,
  referredUserId: string,
): OrdinaryReferralFinancialStatus {
  if (!referredUserId || payment.userId !== referredUserId ||
      !["COURIER_ORDER", "MARKETPLACE_CHECKOUT"].includes(payment.subjectType) ||
      payment.purpose !== "ORDER" || payment.currency !== "ZAR" ||
      !payment.amount.isFinite() || !payment.amount.greaterThan(0)) {
    return "INELIGIBLE_PAYMENT_OWNER";
  }

  const attempt = payment.successfulAttempt;
  const webhook = payment.successWebhookEvent;
  const journal = payment.successLedgerJournal;
  if (!attempt || !webhook || !journal || payment.status !== "SUCCEEDED" ||
      !payment.succeededAt || !payment.providerConfirmedAt || !payment.provider ||
      payment.reconciliationStatus !== "CLEAR" ||
      attempt.paymentId !== payment.id || attempt.status !== "SUCCEEDED" ||
      attempt.provider !== payment.provider || attempt.currency !== "ZAR" ||
      !attempt.amount.equals(payment.amount) ||
      webhook.paymentId !== payment.id || webhook.attemptId !== attempt.id ||
      webhook.provider !== payment.provider || webhook.merchantReference !== attempt.merchantReference ||
      webhook.processingStatus !== "APPLIED" || !webhook.sourceAddressVerified ||
      !webhook.signatureVerified || !webhook.merchantVerified ||
      !webhook.amountVerified || !webhook.providerDataVerified ||
      webhook.ledgerJournalId !== journal.id ||
      journal.type !== "EXTERNAL_PAYMENT_RECEIPT" || journal.currency !== "ZAR" ||
      journal.correlationId !== payment.publicReference ||
      !journal.totalDebits.equals(payment.amount) || !journal.totalCredits.equals(payment.amount) ||
      !isCanonicalExternalPaymentReceipt({ amount: payment.amount, entries: journal.entries })) {
    return "UNVERIFIED_PROVIDER_FUNDING";
  }
  if (attempt.providerEnvironment !== "PRODUCTION" || webhook.environment !== "PRODUCTION") {
    // Sandbox receipts can prove integration correctness but cannot fund an
    // actual customer/store reward liability or real production refund.
    return "SANDBOX_PAYMENT";
  }
  if (payment.totalRefundedAmount.greaterThan(0) ||
      payment.totalRefundReservedAmount.greaterThan(0) || payment.disputes.length > 0) {
    return "REFUND_OR_DISPUTE";
  }
  if (payment.subjectType === "COURIER_ORDER") {
    if (!payment.order || payment.marketplaceOrder ||
        payment.order.customerId !== referredUserId ||
        !["DELIVERED", "COMPLETED"].includes(payment.order.status) ||
        (payment.order.cashOnDelivery &&
          (payment.order.cashOnDelivery.cashObligation.greaterThan(0) &&
            payment.order.cashOnDelivery.status !== "RECONCILED"))) {
      return "INCOMPLETE_FULFILMENT";
    }
  } else {
    if (payment.order || !payment.marketplaceOrder ||
        payment.marketplaceOrder.customerUserId !== referredUserId ||
        payment.marketplaceOrder.status !== "CONFIRMED" ||
        // External provider funding for a deposit cannot stand in for COD.
        payment.marketplaceOrder.cashRequired.greaterThan(0) ||
        payment.marketplaceOrder.storeOrders.length === 0 ||
        payment.marketplaceOrder.storeOrders.some(store =>
          store.status !== "SETTLED" || store.derivedStatus !== "DELIVERED" ||
          store.financialResolutionStatus !== "UNCHANGED")) {
      return "INCOMPLETE_FULFILMENT";
    }
  }
  return "VERIFIED_FIRST_PAID_ORDER";
}
