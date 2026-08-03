import { DriverEarningError } from "./errors";

// Reviewed source lock. Do not replace with an environment-controlled bypass.
export const DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED = false;
export const DRIVER_EARNINGS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;
export function assertDriverEarningsProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new DriverEarningError("DRIVER_EARNING_PRODUCTION_LOCKED", "Driver earning financial operations are inactive pending consolidated validation approval.");
}
