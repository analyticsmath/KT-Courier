import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  verifyOrdinaryReferralPaymentEvidence,
  type OrdinaryReferralPaymentEvidence,
} from "@/lib/rewards/ordinary-referral-financial-evidence";

const money = (amount: string) => new Prisma.Decimal(amount);
const amount = money("100.00");
const asset = { code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" };
const held = { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" };

function payment(): OrdinaryReferralPaymentEvidence {
  return {
    id: "pay-1", publicReference: "PAY-REF-1", userId: "customer-1",
    purpose: "ORDER", subjectType: "COURIER_ORDER", provider: "PAYSTACK", status: "SUCCEEDED",
    currency: "ZAR", amount, succeededAt: new Date("2026-11-08"),
    providerConfirmedAt: new Date("2026-11-08"),
    totalRefundedAmount: money("0.00"), totalRefundReservedAmount: money("0.00"),
    reconciliationStatus: "CLEAR", disputes: [],
    successfulAttempt: {
      id: "attempt-1", paymentId: "pay-1", provider: "PAYSTACK", status: "SUCCEEDED",
      amount, currency: "ZAR", merchantReference: "p-merchant-1", providerEnvironment: "PRODUCTION",
    },
    successWebhookEvent: {
      paymentId: "pay-1", attemptId: "attempt-1", provider: "PAYSTACK", environment: "PRODUCTION",
      merchantReference: "p-merchant-1", processingStatus: "APPLIED",
      sourceAddressVerified: true, signatureVerified: true, merchantVerified: true,
      amountVerified: true, providerDataVerified: true, ledgerJournalId: "journal-1",
    },
    successLedgerJournal: {
      id: "journal-1", type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR",
      correlationId: "PAY-REF-1", totalDebits: amount, totalCredits: amount,
      entries: [
        { direction: "DEBIT", amount, account: asset },
        { direction: "CREDIT", amount, account: held },
      ],
    },
    order: { id: "order-1", customerId: "customer-1", status: "DELIVERED", cashOnDelivery: null },
    marketplaceOrder: null,
  };
}

describe("source-verified first-paid referral financial predicate (read-only)", () => {
  it("recognizes canonical first completed courier payment with real verified provider funding", () => {
    expect(verifyOrdinaryReferralPaymentEvidence(payment(), "customer-1")).toBe("VERIFIED_FIRST_PAID_ORDER");
  });

  it("rejects a different customer, non-order purpose, wrong subject or zero payment", () => {
    const source = payment();
    expect(verifyOrdinaryReferralPaymentEvidence(source, "other-user")).toBe("INELIGIBLE_PAYMENT_OWNER");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, purpose: "SUBSCRIPTION" }, "customer-1")).toBe("INELIGIBLE_PAYMENT_OWNER");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, subjectType: "SUBSCRIPTION_INVOICE" }, "customer-1")).toBe("INELIGIBLE_PAYMENT_OWNER");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, amount: money("0.00") }, "customer-1")).toBe("INELIGIBLE_PAYMENT_OWNER");
  });

  it("refuses missing or forged provider acknowledgement and noncanonical money journals", () => {
    const source = payment();
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successfulAttempt: null }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successWebhookEvent: {
      ...source.successWebhookEvent!, signatureVerified: false,
    } }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successWebhookEvent: {
      ...source.successWebhookEvent!, merchantReference: "forged",
    } }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successLedgerJournal: {
      ...source.successLedgerJournal!, entries: [
        { direction: "DEBIT", amount, account: asset },
        { direction: "CREDIT", amount: money("90.00"), account: held },
      ],
    } }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successLedgerJournal: {
      ...source.successLedgerJournal!, entries: [
        { direction: "DEBIT", amount, account: asset },
        { direction: "CREDIT", amount, account: { ...held, code: "FORGED-HELD" } },
      ],
    } }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, status: "PENDING" }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
  });

  it("never lets a sandbox payment or mismatch environments fund a real incentive", () => {
    const source = payment();
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successfulAttempt: {
      ...source.successfulAttempt!, providerEnvironment: "SANDBOX",
    }, successWebhookEvent: { ...source.successWebhookEvent!, environment: "SANDBOX" } }, "customer-1")).toBe("SANDBOX_PAYMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, successWebhookEvent: {
      ...source.successWebhookEvent!, environment: "SANDBOX",
    } }, "customer-1")).toBe("SANDBOX_PAYMENT");
  });

  it("blocks refund reservations, processed refunds, disputes and reconciliation", () => {
    const source = payment();
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, totalRefundReservedAmount: money("0.01") }, "customer-1")).toBe("REFUND_OR_DISPUTE");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, totalRefundedAmount: money("100.00") }, "customer-1")).toBe("REFUND_OR_DISPUTE");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, disputes: [{ id: "d-1" }] }, "customer-1")).toBe("REFUND_OR_DISPUTE");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, reconciliationStatus: "RECONCILIATION_REQUIRED" }, "customer-1")).toBe("UNVERIFIED_PROVIDER_FUNDING");
  });

  it("requires actual courier completion and fully bank-reconciled COD", () => {
    const source = payment();
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, order: { ...source.order!, status: "PENDING" } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, order: { ...source.order!, customerId: "other" } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, order: {
      ...source.order!, cashOnDelivery: { cashObligation: money("50.00"), status: "COLLECTED" },
    } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...source, order: {
      ...source.order!, cashOnDelivery: { cashObligation: money("50.00"), status: "RECONCILED" },
    } }, "customer-1")).toBe("VERIFIED_FIRST_PAID_ORDER");
  });

  it("requires every marketplace store to be financially settled and physically delivered, without unverified cash", () => {
    const source = payment();
    const marketplace = {
      id: "marketplace-order-1", customerUserId: "customer-1", status: "CONFIRMED",
      cashRequired: money("0.00"), storeOrders: [
        { status: "SETTLED", derivedStatus: "DELIVERED", financialResolutionStatus: "UNCHANGED" },
      ],
    };
    const checked: OrdinaryReferralPaymentEvidence = {
      ...source, subjectType: "MARKETPLACE_CHECKOUT", order: null,
      marketplaceOrder: marketplace,
    };
    expect(verifyOrdinaryReferralPaymentEvidence(checked, "customer-1")).toBe("VERIFIED_FIRST_PAID_ORDER");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...checked, marketplaceOrder: {
      ...marketplace, storeOrders: [],
    } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...checked, marketplaceOrder: {
      ...marketplace, cashRequired: money("50.00"),
    } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...checked, marketplaceOrder: {
      ...marketplace, storeOrders: [
        { status: "SETTLED", derivedStatus: "DELIVERED", financialResolutionStatus: "UNCHANGED" },
        { status: "PENDING_SETTLEMENT", derivedStatus: "IN_TRANSIT", financialResolutionStatus: "UNCHANGED" },
      ],
    } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
    expect(verifyOrdinaryReferralPaymentEvidence({ ...checked, marketplaceOrder: {
      ...marketplace, storeOrders: [
        { status: "SETTLED", derivedStatus: "DELIVERED", financialResolutionStatus: "REFUND_PROCESSING" },
      ],
    } }, "customer-1")).toBe("INCOMPLETE_FULFILMENT");
  });
});
