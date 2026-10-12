import { WithdrawalError } from "./errors";

// This is deliberately reviewed source code, not an environment toggle. Production
// withdrawals remain fail-closed until the consolidated validation gate approves it.
export const WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED = false;
export const WITHDRAWAL_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED";

export function withdrawalProductionReadiness(source: Record<string, string | undefined> = process.env) {
  const isProduction = source.NODE_ENV === "production";
  const active = !isProduction || WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED;
  return Object.freeze({
    productionActive: active,
    payoutEnabled: source.WITHDRAWAL_PAYOUT_ENABLED === "true",
    blockReason: active ? null : WITHDRAWAL_PRODUCTION_BLOCK_REASON,
  });
}

export function assertWithdrawalProductionActivation(source: Record<string, string | undefined> = process.env): void {
  const readiness = withdrawalProductionReadiness(source);
  if (!readiness.productionActive) {
    throw new WithdrawalError("WITHDRAWAL_PRODUCTION_LOCKED", "Withdrawals are locked pending consolidated validation approval.");
  }
}
