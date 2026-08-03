import { Prisma } from "@prisma/client";
import { DriverEarningError } from "./errors";

export type DriverEarningReleasePolicyInput = Readonly<{
  status: string; productionValidationApproved: boolean; completionEvidenceValid: boolean; assignmentDriverMatch: boolean;
  releaseEligibleAt: Date | null; now: Date; refundReservedAmount: Prisma.Decimal; remainingAmount: Prisma.Decimal;
  hasOpenEarningReconciliation: boolean; hasOpenRefundReconciliation: boolean; hasOpenPaymentReconciliation: boolean;
  hasOpenDeliveryIncidentOrAssignmentConflict: boolean; commissionAttributionCoherent: boolean; activeFinanciallyEligibleDriver: boolean;
  activeDriverWallet: boolean; validDriverPayableAccount: boolean; validOwnerWithdrawableAccount: boolean;
  releaseLedgerJournalId: string | null; reversalLedgerJournalId: string | null;
}>;
export function driverEarningReleaseBlockReasons(input: DriverEarningReleasePolicyInput): readonly string[] {
  const reasons: string[] = [];
  if (input.status !== "ACCRUED") reasons.push("STATUS_NOT_ACCRUED");
  if (!input.productionValidationApproved) reasons.push("CONSOLIDATED_VALIDATION_NOT_APPROVED");
  if (!input.completionEvidenceValid) reasons.push("DELIVERY_EVIDENCE_INVALID");
  if (!input.assignmentDriverMatch) reasons.push("ASSIGNMENT_DRIVER_MISMATCH");
  if (!input.releaseEligibleAt) reasons.push("RELEASE_ELIGIBILITY_NOT_ESTABLISHED"); else if (input.now < input.releaseEligibleAt) reasons.push("RELEASE_NOT_MATURE");
  if (!input.refundReservedAmount.isZero()) reasons.push("REFUND_RESERVATION_OPEN");
  if (input.hasOpenEarningReconciliation) reasons.push("DRIVER_EARNING_RECONCILIATION_OPEN");
  if (input.hasOpenRefundReconciliation) reasons.push("REFUND_RECONCILIATION_OPEN");
  if (input.hasOpenPaymentReconciliation) reasons.push("PAYMENT_RECONCILIATION_OPEN");
  if (input.hasOpenDeliveryIncidentOrAssignmentConflict) reasons.push("DELIVERY_INCIDENT_OR_ASSIGNMENT_CONFLICT");
  if (!input.commissionAttributionCoherent) reasons.push("COMMISSION_ATTRIBUTION_MISMATCH");
  if (!input.remainingAmount.greaterThan(0)) reasons.push("NO_REMAINING_ENTITLEMENT");
  if (!input.activeFinanciallyEligibleDriver) reasons.push("DRIVER_FINANCIALLY_INELIGIBLE");
  if (!input.activeDriverWallet) reasons.push("DRIVER_WALLET_INACTIVE");
  if (!input.validDriverPayableAccount) reasons.push("DRIVER_PAYABLE_ACCOUNT_INVALID");
  if (!input.validOwnerWithdrawableAccount) reasons.push("OWNER_WITHDRAWABLE_ACCOUNT_INVALID");
  if (input.releaseLedgerJournalId) reasons.push("RELEASE_ALREADY_POSTED");
  if (input.reversalLedgerJournalId) reasons.push("REVERSAL_ALREADY_POSTED");
  return Object.freeze(reasons);
}
export function assertDriverEarningReleaseEligible(input: DriverEarningReleasePolicyInput): void { const reasons = driverEarningReleaseBlockReasons(input); if (reasons.length) throw new DriverEarningError("DRIVER_EARNING_RELEASE_NOT_ELIGIBLE", "Driver earning is not eligible for release.", { reasons }); }
