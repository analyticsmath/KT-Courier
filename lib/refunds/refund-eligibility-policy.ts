import { RefundError } from "./errors";
import type { RefundMethodCode, RefundReasonCodeValue } from "./types";
import { REFUND_METHODS, REFUND_REASON_CODES } from "./types";

export function assertRefundEligibility(input: Readonly<{
  paymentStatus: string;
  paymentCustomerUserId: string;
  requestingCustomerUserId: string;
  currency: string;
  paymentAmount: string;
  remainingRefundableAmount: string;
  requestedAmount: string;
  hasVerifiedSuccessfulAttempt: boolean;
  hasVerifiedWebhook: boolean;
  hasSuccessLedgerJournal: boolean;
  hasIncompatibleActiveRefund: boolean;
  hasChargebackOrDisputeEvidence: boolean;
  financialAllocationsSafe: boolean;
  customerWalletProvisioned: boolean;
  providerReferenceAvailable: boolean;
  providerSupportsMethod: boolean;
  method: RefundMethodCode;
  reasonCode: RefundReasonCodeValue;
}>): void {
  if (
    input.paymentStatus !== "SUCCEEDED"
    || input.paymentCustomerUserId !== input.requestingCustomerUserId
    || input.currency !== "ZAR"
    || !input.hasVerifiedSuccessfulAttempt
    || !input.hasVerifiedWebhook
    || !input.hasSuccessLedgerJournal
    || input.hasChargebackOrDisputeEvidence
    || !input.financialAllocationsSafe
    || !(REFUND_METHODS as readonly string[]).includes(input.method)
    || !(REFUND_REASON_CODES as readonly string[]).includes(input.reasonCode)
  ) {
    throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Payment is not eligible for this refund request.");
  }
  if (input.hasIncompatibleActiveRefund) {
    throw new RefundError("REFUND_INVALID_STATE", "An incompatible active refund already exists for this payment.");
  }
  if (input.method === "CUSTOMER_WALLET" && !input.customerWalletProvisioned) {
    throw new RefundError("REFUND_PAYMENT_INELIGIBLE", "Customer wallet is not provisioned for wallet refund credit.");
  }
  if (input.method === "ORIGINAL_PAYMENT_METHOD" && (!input.providerReferenceAvailable || !input.providerSupportsMethod)) {
    throw new RefundError("REFUND_PROVIDER_UNSUPPORTED", "Original-payment-method refund is unavailable for this payment.");
  }
}
