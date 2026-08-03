import { WithdrawalError } from "./errors";

// This is deliberately reviewed source code, not an environment toggle. Production
// withdrawals remain fail-closed until the consolidated validation gate approves it.
export const WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED = false;
export const WITHDRAWAL_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED";

export function withdrawalProductionReadiness() {
  return Object.freeze({
    productionActive: process.env.NODE_ENV !== "production" || WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED,
    blockReason: WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED ? null : WITHDRAWAL_PRODUCTION_BLOCK_REASON,
  });
}

export function assertWithdrawalProductionActivation(): void {
  const readiness = withdrawalProductionReadiness();
  if (!readiness.productionActive) {
    throw new WithdrawalError("WITHDRAWAL_PRODUCTION_LOCKED", "Withdrawals are locked pending consolidated validation approval.");
  }
}
