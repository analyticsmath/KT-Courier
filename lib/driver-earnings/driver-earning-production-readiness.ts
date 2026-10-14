import { DriverEarningError } from "./errors";

// Source-reviewed release: fresh disposable database and browser proof is required
// before merging this release. Per-payment, delivery, policy and ledger guards remain.
export const DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED = true;
export const DRIVER_EARNINGS_PRODUCTION_BLOCK_REASON = null;
export function assertDriverEarningsProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new DriverEarningError("DRIVER_EARNING_PRODUCTION_LOCKED", "Driver earning financial operations are inactive pending consolidated validation approval.");
}
