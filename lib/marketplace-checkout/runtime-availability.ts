import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
/** Runtime dependencies are intentionally injected by the reviewed composition root; routes never fall back to client calculations or direct provider calls. */
export function marketplaceRuntimeUnavailable(capability: string): never { throw new MarketplaceCheckoutError("PRODUCTION_LOCKED", `${capability} is unavailable until its reviewed marketplace runtime adapter is configured.`); }
