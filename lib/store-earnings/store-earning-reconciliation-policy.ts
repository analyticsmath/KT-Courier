export const STORE_EARNING_RECONCILIATION_REASONS = [
  "SETTLEMENT_BASIS_MISMATCH", "COMMISSION_ATTRIBUTION_MISMATCH", "COMMISSION_OVER_ATTRIBUTION", "DUPLICATE_STORE_SETTLEMENT", "LEDGER_LINK_MISSING", "LEDGER_AMOUNT_MISMATCH", "REFUND_ADJUSTMENT_MISMATCH", "REFUND_AFTER_RELEASE", "RELEASE_WITH_OPEN_REFUND", "RELEASE_BALANCE_MISMATCH", "REVERSAL_BLOCKED_BY_COMMISSION", "REVERSAL_AFTER_RELEASE", "STORE_ACCOUNT_MISMATCH", "STALE_ACCRUAL", "APPLICATION_FAILURE",
] as const;
export const STORE_EARNING_RECONCILIATION_STATUSES = ["OPEN", "MONITORING", "RESOLVED", "CLOSED"] as const;

export function isOpenStoreEarningReconciliation(status: string): boolean {
  return status === "OPEN" || status === "MONITORING";
}

export function mayResolveStoreEarningReconciliation(input: Readonly<{ financialInvariantRestored: boolean; canonicalOperationReference?: string }>): boolean {
  return input.financialInvariantRestored && Boolean(input.canonicalOperationReference?.trim());
}
