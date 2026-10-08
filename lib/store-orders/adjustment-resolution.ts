/** Completing one adjustment cannot clear another outstanding obligation. */
export function completedAdjustmentResolution(input: { pendingStatuses: readonly string[]; openIssues: number; openCases: number }) {
  if (input.openCases || input.pendingStatuses.includes("RECONCILIATION_REQUIRED")) return { financialResolutionStatus: "RECONCILIATION_REQUIRED", resolutionStatus: "RECONCILIATION_REQUIRED" } as const;
  if (input.pendingStatuses.length) return { financialResolutionStatus: input.pendingStatuses.includes("REFUND_PENDING") ? "REFUND_RESERVED" : "ADJUSTMENT_CALCULATED", resolutionStatus: "REFUND_PENDING" } as const;
  return { financialResolutionStatus: "REFUND_COMPLETED", resolutionStatus: input.openIssues ? "ISSUE_OPEN" : "RESOLVED" } as const;
}
