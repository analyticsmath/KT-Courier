import { isLocalStorefrontValidationAllowed } from "@/lib/testing/safe-postgres-validator";
import { isStorefrontExposureAllowed } from "@/lib/runtime/deployment-classification";

export const STOREFRONT_PRODUCTION_VALIDATION_APPROVED = true as const;
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

export function storefrontPublicExposureAllowed(env: Record<string, string | undefined> = process["env"]): boolean {
  if (STOREFRONT_PRODUCTION_VALIDATION_APPROVED) return true;
  return isStorefrontExposureAllowed(env, STOREFRONT_PRODUCTION_VALIDATION_APPROVED) || isLocalStorefrontValidationAllowed(env as NodeJS.ProcessEnv);
}
