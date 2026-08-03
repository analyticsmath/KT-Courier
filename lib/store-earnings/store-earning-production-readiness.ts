import { StoreEarningError } from "./errors";

// Reviewed source-level lock. Do not replace this with an environment bypass.
export const STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED = false;
export const STORE_EARNINGS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export function assertStoreEarningsProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new StoreEarningError("STORE_EARNING_PRODUCTION_LOCKED", "Store earning financial operations are inactive pending consolidated validation approval.");
}
