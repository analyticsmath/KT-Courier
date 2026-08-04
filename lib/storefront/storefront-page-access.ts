import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

/**
 * Keeps public page rendering and metadata behind the same exposure decision as
 * the public API. This gate runs before any projection-backed page data request.
 */
export function publicStorefrontPageExposureAllowed(): boolean {
  return storefrontPublicExposureAllowed();
}
