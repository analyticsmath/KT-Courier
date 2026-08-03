import { Prisma } from "@prisma/client";
import { DriverEarningError } from "./errors";

export const DRIVER_EARNING_REVERSAL_REASON_CODES = ["DELIVERY_CANCELLED_BEFORE_ENTITLEMENT", "DELIVERY_COMPLETION_INVALIDATED", "ASSIGNMENT_MISMATCH", "DUPLICATE_SETTLEMENT", "SETTLEMENT_CALCULATION_ERROR", "PAYMENT_INVALIDATED", "OTHER_REVIEWED"] as const;
export type DriverEarningReversalReasonCode = (typeof DRIVER_EARNING_REVERSAL_REASON_CODES)[number];
export function assertDriverEarningReversalPolicy(input: Readonly<{ status: string; releasedAmount: Prisma.Decimal; refundReservedAmount: Prisma.Decimal; remainingAmount: Prisma.Decimal; releaseLedgerJournalId: string | null; reversalLedgerJournalId: string | null; commissionTreatmentCoherent: boolean; reviewedReconciliation: boolean; reversalEvidenceReference: string }>): void {
  const stateAllowed = input.status === "ACCRUED" || (input.status === "RECONCILIATION_REQUIRED" && input.reviewedReconciliation);
  if (!stateAllowed || !input.releasedAmount.isZero() || !input.refundReservedAmount.isZero() || !input.remainingAmount.greaterThan(0) || input.releaseLedgerJournalId || input.reversalLedgerJournalId || !input.commissionTreatmentCoherent || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(input.reversalEvidenceReference)) throw new DriverEarningError("DRIVER_EARNING_REVERSAL_NOT_ALLOWED", "Driver earning reversal lacks reviewed evidence or has unresolved downstream exposure.");
}
