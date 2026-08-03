import { Prisma } from "@prisma/client";
import { StoreEarningError } from "./errors";

export const STORE_EARNING_REVERSAL_REASON_CODES = [
  "SETTLEMENT_INVALIDATED",
  "STORE_ENTITLEMENT_CANCELLED",
  "DUPLICATE_SETTLEMENT_CORRECTION",
  "AUTHORITATIVE_RECALCULATION",
] as const;
export type StoreEarningReversalReasonCode = (typeof STORE_EARNING_REVERSAL_REASON_CODES)[number];

export function assertStoreEarningReversalPolicy(input: Readonly<{
  status: string;
  releasedAmount: Prisma.Decimal;
  refundReservedAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  releaseLedgerJournalId: string | null;
  reversalLedgerJournalId: string | null;
  commissionTreatmentCoherent: boolean;
  reviewedReconciliation: boolean;
}>): void {
  const stateAllowed = input.status === "ACCRUED" || (input.status === "RECONCILIATION_REQUIRED" && input.reviewedReconciliation);
  if (!stateAllowed || !input.releasedAmount.isZero() || !input.refundReservedAmount.isZero() || !input.remainingAmount.greaterThan(0) || input.releaseLedgerJournalId || input.reversalLedgerJournalId || !input.commissionTreatmentCoherent) {
    throw new StoreEarningError("STORE_EARNING_REVERSAL_NOT_ALLOWED", "Store earning cannot be reversed while downstream, refund, or commission evidence is unresolved.");
  }
}
