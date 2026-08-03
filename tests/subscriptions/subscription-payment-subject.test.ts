import { describe, expect, it } from "vitest";
import { assertPaymentSubjectIntegrity } from "@/lib/payments/payment-subject-policy";
import { PaymentError } from "@/lib/payments/errors";

describe("subscription-payment-subject", () => {
  it("requires a subscription invoice and its exact authorised payer", () => {
    expect(() => assertPaymentSubjectIntegrity({ subjectType: "SUBSCRIPTION_INVOICE", userId: "payer", orderId: null, marketplaceCheckoutId: null, marketplaceOrderId: null, subscriptionInvoiceId: "invoice", subscriptionInvoicePayerUserId: "payer" })).not.toThrow();
    expect(() => assertPaymentSubjectIntegrity({ subjectType: "SUBSCRIPTION_INVOICE", userId: "payer", orderId: "order", marketplaceCheckoutId: null, subscriptionInvoiceId: "invoice", subscriptionInvoicePayerUserId: "payer" })).toThrow(PaymentError);
  });
});
