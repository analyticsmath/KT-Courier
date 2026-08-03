import type { PaymentReconciliationReasonCode } from "@/lib/payments/types";

export type ReconciliationPriorityCode = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function reconciliationPriority(reason: PaymentReconciliationReasonCode): ReconciliationPriorityCode {
  if (reason === "PROVIDER_REFERENCE_CONFLICT" || reason === "CONFLICTING_PROVIDER_STATUS") return "CRITICAL";
  if (reason === "AMOUNT_MISMATCH" || reason === "MERCHANT_MISMATCH" || reason === "APPLICATION_FAILURE_AFTER_VERIFICATION") return "HIGH";
  if (reason === "CREDENTIAL_VERSION_MISMATCH" || reason === "UNKNOWN_OUTCOME" || reason === "UNRECOGNIZED_PROVIDER_STATUS") return "MEDIUM";
  return "LOW";
}

export function reconciliationSummary(reason: PaymentReconciliationReasonCode): string {
  const summaries: Record<PaymentReconciliationReasonCode, string> = {
    UNKNOWN_OUTCOME: "The provider outcome remains unknown and requires verified evidence.",
    CREDENTIAL_VERSION_MISMATCH: "The attempt credential version differs from the active credential set.",
    PROVIDER_CONFIRMATION_UNAVAILABLE: "Payfast query validation was temporarily unavailable.",
    CONFLICTING_PROVIDER_STATUS: "Verified provider status conflicts with established successful evidence.",
    OUT_OF_ORDER_EVENT: "Verified provider evidence arrived out of order and was not allowed to downgrade state.",
    AMOUNT_MISMATCH: "Payfast gross amount differs from the authoritative payment amount.",
    MERCHANT_MISMATCH: "Payfast Merchant ID differs from the configured merchant identity.",
    PROVIDER_REFERENCE_CONFLICT: "Payfast payment identity conflicts with the attempt's established provider reference.",
    UNRECOGNIZED_PROVIDER_STATUS: "Payfast returned a verified status outside the conservative allowlist.",
    APPLICATION_FAILURE_AFTER_VERIFICATION: "Verified evidence could not be applied atomically.",
    STALE_PROCESSING_ATTEMPT: "The payment attempt remained unresolved beyond the reconciliation threshold.",
  };
  return summaries[reason];
}
