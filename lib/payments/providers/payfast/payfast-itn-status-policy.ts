import type { PaymentAttemptState, PaymentState, PaymentWebhookNormalizedStatusCode } from "@/lib/payments/types";

export function normalizePayfastItnStatus(providerStatus: string): PaymentWebhookNormalizedStatusCode {
  if (providerStatus === "COMPLETE") return "COMPLETE";
  if (providerStatus === "PENDING") return "PENDING";
  if (providerStatus === "FAILED") return "FAILED";
  return "UNKNOWN";
}

export type PayfastEventDecision = Readonly<{
  action: "SUCCEED" | "PROCESS" | "FAIL" | "IGNORE_STALE" | "RECONCILE" | "DUPLICATE";
  paymentStatus: PaymentState;
  attemptStatus: PaymentAttemptState;
  ledgerRequired: boolean;
  reconciliationReason: "CONFLICTING_PROVIDER_STATUS" | "UNRECOGNIZED_PROVIDER_STATUS" | "OUT_OF_ORDER_EVENT" | null;
}>;

export function decidePayfastItnApplication(input: {
  normalizedStatus: PaymentWebhookNormalizedStatusCode;
  paymentStatus: PaymentState;
  attemptStatus: PaymentAttemptState;
  successAlreadyLinked: boolean;
}): PayfastEventDecision {
  if (input.normalizedStatus === "COMPLETE") {
    if (input.paymentStatus === "SUCCEEDED" && input.successAlreadyLinked) {
      return Object.freeze({ action: "DUPLICATE", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", ledgerRequired: false, reconciliationReason: null });
    }
    return Object.freeze({ action: "SUCCEED", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", ledgerRequired: true, reconciliationReason: null });
  }
  if (input.paymentStatus === "SUCCEEDED") {
    if (input.normalizedStatus === "PENDING") {
      return Object.freeze({ action: "IGNORE_STALE", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", ledgerRequired: false, reconciliationReason: "OUT_OF_ORDER_EVENT" });
    }
    return Object.freeze({ action: "RECONCILE", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", ledgerRequired: false, reconciliationReason: "CONFLICTING_PROVIDER_STATUS" });
  }
  if (input.normalizedStatus === "PENDING") {
    return Object.freeze({ action: "PROCESS", paymentStatus: "PROCESSING", attemptStatus: "PROCESSING", ledgerRequired: false, reconciliationReason: null });
  }
  if (input.normalizedStatus === "FAILED") {
    return Object.freeze({ action: "FAIL", paymentStatus: "FAILED", attemptStatus: "FAILED", ledgerRequired: false, reconciliationReason: null });
  }
  return Object.freeze({ action: "RECONCILE", paymentStatus: "PROCESSING", attemptStatus: input.attemptStatus === "UNKNOWN" ? "UNKNOWN" : "PROCESSING", ledgerRequired: false, reconciliationReason: "UNRECOGNIZED_PROVIDER_STATUS" });
}
