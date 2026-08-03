import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { resolveSubscriptionProviderEvent } from "@/lib/subscriptions/subscription-provider-event-resolution.service";

const base = { merchantInvoiceReference: "subinv_A1", preparedInvoiceReference: "subinv_A1", providerPaymentReference: "pf_A1", previousProviderPaymentReference: null, providerToken: "token_A1_123", expectedTokenFingerprint: createHash("sha256").update("token_A1_123").digest("hex"), payerUserId: "customer_A1", invoicePayerUserId: "customer_A1", amount: "25.00", invoiceAmount: "25.00", currency: "ZAR", invoiceCurrency: "ZAR", providerEnvironment: "SANDBOX" as const, preparedEnvironment: "SANDBOX" as const, cycleNumber: 1, invoiceStatus: "ISSUED" as const };

describe("subscription provider-event resolution", () => {
  it("maps exact initial and renewal events, replays duplicates, and reconciles amount/token/unmatched conflicts", () => {
    expect(resolveSubscriptionProviderEvent(base)).toBe("INITIAL_PAYMENT");
    expect(resolveSubscriptionProviderEvent({ ...base, cycleNumber: 2 })).toBe("RENEWAL_PAYMENT");
    expect(resolveSubscriptionProviderEvent({ ...base, invoiceStatus: "PAID", previousProviderPaymentReference: "pf_A1" })).toBe("DUPLICATE");
    expect(resolveSubscriptionProviderEvent({ ...base, amount: "24.99" })).toBe("RECONCILIATION_REQUIRED");
    expect(resolveSubscriptionProviderEvent({ ...base, providerToken: "other_token_123" })).toBe("RECONCILIATION_REQUIRED");
    expect(resolveSubscriptionProviderEvent({ ...base, merchantInvoiceReference: "subinv_other" })).toBe("RECONCILIATION_REQUIRED");
  });
});
