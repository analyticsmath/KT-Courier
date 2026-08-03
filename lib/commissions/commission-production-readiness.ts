import { CommissionError } from "./errors";

// This intentionally remains a reviewed source-level lock while consolidated
// database, concurrency, integration, and browser validation is deferred.
export const COMMISSION_PRODUCTION_VALIDATION_APPROVED = false;

export function assertCommissionProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (COMMISSION_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new CommissionError("COMMISSION_PRODUCTION_LOCKED", "Commission financial operations are inactive pending consolidated validation approval.");
}
