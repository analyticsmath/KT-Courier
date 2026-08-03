import { PromoterError } from "./errors";

/** Source lock: only Phase 26.5 may change this after consolidated proof. */
export const PROMOTERS_PRODUCTION_VALIDATION_APPROVED = false;
export const PROMOTERS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

/**
 * This is intentionally unconditional.  A test parameter or environment switch
 * would turn the release gate into a production bypass, so tests exercise the
 * policy/services with injected repositories instead.
 */
export function assertPromotersProductionReady(): void {
  if (PROMOTERS_PRODUCTION_VALIDATION_APPROVED) return;
  throw new PromoterError("PROMOTER_PRODUCTION_LOCKED", `Promoter operations are inactive pending ${PROMOTERS_PRODUCTION_BLOCK_REASON}.`);
}
