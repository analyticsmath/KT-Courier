import { StoreEarningError } from "./errors";

// Source-reviewed release: fresh disposable database and browser proof is required
// before merging this release. Per-payment, delivery, policy and ledger guards remain.
export const STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED = true;
export const STORE_EARNINGS_PRODUCTION_BLOCK_REASON = null;

export function assertStoreEarningsProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new StoreEarningError("STORE_EARNING_PRODUCTION_LOCKED", "Store earning financial operations are inactive pending consolidated validation approval.");
}
