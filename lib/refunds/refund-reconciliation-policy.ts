export const OPEN_REFUND_RECONCILIATION_STATUSES = Object.freeze(["OPEN", "MONITORING"] as const);

export function refundAttemptIsStale(input: Readonly<{ status: string; updatedAt: Date; now: Date; thresholdMs: number }>): boolean {
  return input.status === "PROCESSING" && input.now.getTime() - input.updatedAt.getTime() >= input.thresholdMs;
}

export function refundRequiresReconciliation(input: Readonly<{
  refundStatus: string;
  reserveJournalPresent: boolean;
  releaseJournalPresent: boolean;
  completionJournalPresent: boolean;
  attemptStatus?: string | null;
}>): boolean {
  if (input.refundStatus === "RECONCILIATION_REQUIRED" || input.attemptStatus === "UNKNOWN") return true;
  if (!input.reserveJournalPresent) return true;
  if (input.releaseJournalPresent && input.completionJournalPresent) return true;
  if (input.refundStatus === "SUCCEEDED" && !input.completionJournalPresent) return true;
  return (input.refundStatus === "REJECTED" || input.refundStatus === "CANCELLED") && !input.releaseJournalPresent;
}

