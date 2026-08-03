import { Prisma } from "@prisma/client";
import { StoreEarningError } from "./errors";

export type StoreEarningReleasePolicyInput = Readonly<{
  status: "ACCRUED" | "RELEASED" | "FULLY_REFUNDED" | "REVERSED" | "RECONCILIATION_REQUIRED";
  productionValidationApproved: boolean;
  releaseEligibleAt: Date | null;
  now: Date;
  refundReservedAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  hasOpenEarningReconciliation: boolean;
  hasOpenRefundReconciliation: boolean;
  commissionAttributionCoherent: boolean;
  hasPaymentConflict: boolean;
  activeStore: boolean;
  validOwnerWithdrawableAccount: boolean;
  validStorePayableAccount: boolean;
  releaseLedgerJournalId: string | null;
  reversalLedgerJournalId: string | null;
}>;

export function storeEarningReleaseBlockReasons(input: StoreEarningReleasePolicyInput): readonly string[] {
  const reasons: string[] = [];
  if (input.status !== "ACCRUED") reasons.push("STATUS_NOT_ACCRUED");
  if (!input.productionValidationApproved) reasons.push("CONSOLIDATED_VALIDATION_NOT_APPROVED");
  if (!input.releaseEligibleAt) reasons.push("RELEASE_ELIGIBILITY_NOT_ESTABLISHED");
  else if (input.now.getTime() < input.releaseEligibleAt.getTime()) reasons.push("RELEASE_NOT_MATURE");
  if (!input.refundReservedAmount.isZero()) reasons.push("REFUND_RESERVATION_OPEN");
  if (input.hasOpenEarningReconciliation) reasons.push("STORE_EARNING_RECONCILIATION_OPEN");
  if (input.hasOpenRefundReconciliation) reasons.push("REFUND_RECONCILIATION_OPEN");
  if (!input.commissionAttributionCoherent) reasons.push("COMMISSION_ATTRIBUTION_MISMATCH");
  if (input.hasPaymentConflict) reasons.push("PAYMENT_CONFLICT");
  if (!input.remainingAmount.greaterThan(0)) reasons.push("NO_REMAINING_ENTITLEMENT");
  if (!input.activeStore) reasons.push("STORE_INACTIVE");
  if (!input.validOwnerWithdrawableAccount) reasons.push("OWNER_WITHDRAWABLE_ACCOUNT_INVALID");
  if (!input.validStorePayableAccount) reasons.push("STORE_PAYABLE_ACCOUNT_INVALID");
  if (input.releaseLedgerJournalId) reasons.push("RELEASE_ALREADY_POSTED");
  if (input.reversalLedgerJournalId) reasons.push("REVERSAL_ALREADY_POSTED");
  return Object.freeze(reasons);
}

export function assertStoreEarningReleaseEligible(input: StoreEarningReleasePolicyInput): void {
  const reasons = storeEarningReleaseBlockReasons(input);
  if (reasons.length) throw new StoreEarningError("STORE_EARNING_RELEASE_NOT_ELIGIBLE", "Store earning is not eligible for release.", { reasons });
}
