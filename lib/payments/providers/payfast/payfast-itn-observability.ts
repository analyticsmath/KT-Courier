export type PayfastItnMetric =
  | "received"
  | "rejected_transport"
  | "rejected_source"
  | "rejected_signature"
  | "amount_mismatch"
  | "provider_confirmation_unavailable"
  | "verified"
  | "duplicate"
  | "applied"
  | "ignored_stale"
  | "reconciliation_required";

type SafeObservation = Readonly<{
  eventPublicReference?: string;
  environment?: "SANDBOX" | "PRODUCTION";
  normalizedStatus?: "COMPLETE" | "PENDING" | "FAILED" | "UNKNOWN";
  processingStatus?: string;
  durationMs?: number;
  safeErrorCode?: string;
}>;

// The structured event name and closed metric union let the deployment's log
// collector derive counters without receiving request bodies, signatures,
// credentials, payer identity, headers, or validation responses.
export function observePayfastItn(metric: PayfastItnMetric, observation: SafeObservation = {}): void {
  console.info("payfast_itn", { metric, ...observation });
}
