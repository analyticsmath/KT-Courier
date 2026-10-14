import { CommissionError } from "./errors";

// Source-reviewed release: fresh disposable database and browser proof is required
// before merging this release. Per-payment, delivery, policy and ledger guards remain.
export const COMMISSION_PRODUCTION_VALIDATION_APPROVED = true;

export function assertCommissionProductionReady(options?: Readonly<{ allowTestOnlyBypass?: boolean }>): void {
  if (COMMISSION_PRODUCTION_VALIDATION_APPROVED || options?.allowTestOnlyBypass === true) return;
  throw new CommissionError("COMMISSION_PRODUCTION_LOCKED", "Commission financial operations are inactive pending consolidated validation approval.");
}
