export const ADVERTISING_PRODUCTION_VALIDATION_APPROVED = false as const;
export const ADVERTISING_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class AdvertisingProductionLockedError extends Error {
  readonly code = ADVERTISING_PRODUCTION_BLOCK_REASON;
  constructor(
    readonly operation:
      | "CAMPAIGN_ACTIVATE"
      | "CAMPAIGN_FUNDING"
      | "SPONSORED_SERVING"
      | "MEASUREMENT_INGESTION"
      | "CLICK_CHARGING"
      | "INVALID_CLICK_REVERSAL"
      | "FUNDING_RETURN"
  ) {
    super(`${operation} is inactive until consolidated validation is approved.`);
    this.name = "AdvertisingProductionLockedError";
  }
}

export function assertAdvertisingProductionReady(
  operation: AdvertisingProductionLockedError["operation"]
): void {
  if (ADVERTISING_PRODUCTION_VALIDATION_APPROVED) return;
  throw new AdvertisingProductionLockedError(operation);
}

export function advertisingProductionReady(): boolean {
  return ADVERTISING_PRODUCTION_VALIDATION_APPROVED;
}
