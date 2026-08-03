import { describe, expect, it } from "vitest";
import { assertRefundEligibility } from "@/lib/refunds/refund-eligibility-policy";

const eligible = { paymentStatus: "SUCCEEDED", paymentCustomerUserId: "customer-1", requestingCustomerUserId: "customer-1", currency: "ZAR", paymentAmount: "100.00", remainingRefundableAmount: "100.00", requestedAmount: "25.00", hasVerifiedSuccessfulAttempt: true, hasVerifiedWebhook: true, hasSuccessLedgerJournal: true, hasIncompatibleActiveRefund: false, hasChargebackOrDisputeEvidence: false, financialAllocationsSafe: true, customerWalletProvisioned: true, providerReferenceAvailable: true, providerSupportsMethod: true, method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE" } as const;

describe("refund eligibility", () => {
  it("requires immutable success evidence and ownership", () => {
    expect(() => assertRefundEligibility(eligible)).not.toThrow();
    expect(() => assertRefundEligibility({ ...eligible, hasVerifiedWebhook: false })).toThrow(/not eligible/i);
    expect(() => assertRefundEligibility({ ...eligible, requestingCustomerUserId: "other" })).toThrow(/not eligible/i);
  });
  it("requires a wallet only for wallet refunds", () => expect(() => assertRefundEligibility({ ...eligible, customerWalletProvisioned: false })).toThrow(/not provisioned/i));
  it("requires provider evidence and capability for original-method refunds", () => expect(() => assertRefundEligibility({ ...eligible, method: "ORIGINAL_PAYMENT_METHOD", providerReferenceAvailable: false })).toThrow(/unavailable/i));
  it("blocks unsafe allocations and incompatible active refunds", () => {
    expect(() => assertRefundEligibility({ ...eligible, financialAllocationsSafe: false })).toThrow();
    expect(() => assertRefundEligibility({ ...eligible, hasIncompatibleActiveRefund: true })).toThrow(/active refund/i);
  });
});
