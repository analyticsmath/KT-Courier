import { describe, expect, it, vi } from "vitest";
import { onVerifiedSubscriptionPaymentSucceeded } from "@/lib/subscriptions/subscription-payment-success-hook.service";

const providerEvent = {
  merchantInvoiceReference: "subinv_A1", preparedInvoiceReference: "subinv_A1", providerPaymentReference: "pf_A1", previousProviderPaymentReference: null,
  providerTokenFingerprint: "fingerprint_A1", expectedTokenFingerprint: "fingerprint_A1", amount: "25.00", invoiceAmount: "25.00",
  currency: "ZAR", invoiceCurrency: "ZAR", providerEnvironment: "SANDBOX" as const, preparedEnvironment: "SANDBOX" as const,
  cycleNumber: 1, invoiceStatus: "ISSUED" as const,
};
const payment = { id: "pay_A1", subjectType: "SUBSCRIPTION_INVOICE" as const, userId: "customer_A1", orderId: null, marketplaceCheckoutId: null, marketplaceOrderId: null, subscriptionInvoiceId: "invoice_A1", subscriptionInvoicePayerUserId: "customer_A1", status: "SUCCEEDED", providerEvent };

describe("verified subscription ITN activation", () => {
  it("settles before activation and replays duplicate evidence", async () => {
    const settle = vi.fn().mockResolvedValue({ outcome: "DUPLICATE" });
    await onVerifiedSubscriptionPaymentSucceeded({ getSuccessfulSubscriptionPayment: async () => payment, settleAndActivatePaidInvoice: settle, openApplicationReconciliation: vi.fn() }, payment.id);
    expect(settle).toHaveBeenCalledWith({ paymentId: "pay_A1", invoiceId: "invoice_A1", operationId: "subscription-activation:pay_A1" });
  });

  it("opens subscription reconciliation after settlement failure but leaves Phase 12 payment success untouched", async () => {
    const reconcile = vi.fn();
    await onVerifiedSubscriptionPaymentSucceeded({ getSuccessfulSubscriptionPayment: async () => payment, settleAndActivatePaidInvoice: async () => { throw new Error("ledger unavailable"); }, openApplicationReconciliation: reconcile }, payment.id);
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ reason: "APPLICATION_FAILURE", paymentId: "pay_A1" }));
  });

  it("does not activate unrelated or mismatched payment subjects", async () => {
    const settle = vi.fn();
    await onVerifiedSubscriptionPaymentSucceeded({ getSuccessfulSubscriptionPayment: async () => ({ ...payment, subjectType: "COURIER_ORDER" as const }), settleAndActivatePaidInvoice: settle, openApplicationReconciliation: vi.fn() }, payment.id);
    expect(settle).not.toHaveBeenCalled();
  });

  it("holds a successful payment for reconciliation when verified subscription-event evidence is missing or mismatched", async () => {
    const settle = vi.fn(); const reconcile = vi.fn();
    await onVerifiedSubscriptionPaymentSucceeded({ getSuccessfulSubscriptionPayment: async () => ({ ...payment, providerEvent: undefined }), settleAndActivatePaidInvoice: settle, openApplicationReconciliation: reconcile }, payment.id);
    await onVerifiedSubscriptionPaymentSucceeded({ getSuccessfulSubscriptionPayment: async () => ({ ...payment, providerEvent: { ...providerEvent, providerTokenFingerprint: "unexpected" } }), settleAndActivatePaidInvoice: settle, openApplicationReconciliation: reconcile }, payment.id);
    expect(settle).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ reason: "PROVIDER_EVENT_MISSING" }));
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ reason: "PROVIDER_TOKEN_MISMATCH" }));
  });
});
