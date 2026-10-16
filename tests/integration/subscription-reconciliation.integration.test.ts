import { describe, expect, it } from "vitest";
import { resolveSubscriptionProviderEvent } from "@/lib/subscriptions/subscription-provider-event-resolution.service";

describe("Subscription Provider Event Resolution & Reconciliation Integration Tests", () => {
  const baseInput = {
    merchantInvoiceReference: "INV-100",
    preparedInvoiceReference: "INV-100",
    providerPaymentReference: "prov-pay-1",
    previousProviderPaymentReference: null,
    providerToken: null,
    expectedTokenFingerprint: null,
    payerUserId: "user-1",
    invoicePayerUserId: "user-1",
    amount: "150.00",
    invoiceAmount: "150.00",
    currency: "ZAR",
    invoiceCurrency: "ZAR",
    providerEnvironment: "PRODUCTION" as const,
    preparedEnvironment: "PRODUCTION" as const,
    cycleNumber: 1,
    invoiceStatus: "ISSUED" as const,
  };

  it("resolves cycle 1 event as INITIAL_PAYMENT", () => {
    const outcome = resolveSubscriptionProviderEvent(baseInput);
    expect(outcome).toBe("INITIAL_PAYMENT");
  });

  it("resolves cycle 2+ event as RENEWAL_PAYMENT", () => {
    const outcome = resolveSubscriptionProviderEvent({
      ...baseInput,
      cycleNumber: 2,
    });
    expect(outcome).toBe("RENEWAL_PAYMENT");
  });

  it("returns DUPLICATE when payment was already marked paid with same provider reference", () => {
    const outcome = resolveSubscriptionProviderEvent({
      ...baseInput,
      invoiceStatus: "PAID",
      previousProviderPaymentReference: "prov-pay-1",
    });
    expect(outcome).toBe("DUPLICATE");
  });

  it("routes to RECONCILIATION_REQUIRED when currency is not ZAR", () => {
    const outcome = resolveSubscriptionProviderEvent({
      ...baseInput,
      currency: "USD",
    });
    expect(outcome).toBe("RECONCILIATION_REQUIRED");
  });

  it("routes to RECONCILIATION_REQUIRED when payer identity mismatches", () => {
    const outcome = resolveSubscriptionProviderEvent({
      ...baseInput,
      payerUserId: "fraudulent-user",
    });
    expect(outcome).toBe("RECONCILIATION_REQUIRED");
  });

  it("routes to RECONCILIATION_REQUIRED when environments mismatch", () => {
    const outcome = resolveSubscriptionProviderEvent({
      ...baseInput,
      providerEnvironment: "SANDBOX",
      preparedEnvironment: "PRODUCTION",
    });
    expect(outcome).toBe("RECONCILIATION_REQUIRED");
  });
});
