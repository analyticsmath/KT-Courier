import { isLocalStorefrontValidationAllowed } from "@/lib/testing/safe-postgres-validator";

export const STOREFRONT_PRODUCTION_VALIDATION_APPROVED = false as const;
export const STOREFRONT_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class StorefrontProductionLockedError extends Error {
  readonly code = STOREFRONT_PRODUCTION_BLOCK_REASON;

  constructor() {
    super("Public storefront catalog exposure is blocked until consolidated validation is approved.");
    this.name = "StorefrontProductionLockedError";
  }
}

/** Public routes must call this before returning catalog-derived evidence. */
export function assertStorefrontPublicExposureAllowed(): void {
  if (!storefrontPublicExposureAllowed()) throw new StorefrontProductionLockedError();
}

export function storefrontPublicExposureAllowed(): boolean {
  return STOREFRONT_PRODUCTION_VALIDATION_APPROVED || isLocalStorefrontValidationAllowed();
}
