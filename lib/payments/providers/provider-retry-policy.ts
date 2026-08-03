import type { PaymentProviderCapabilities } from "./payment-provider-adapter";
import type { NormalizedProviderError } from "./provider-errors";

export function mayRetryProviderSession(args: {
  capabilities: PaymentProviderCapabilities;
  error: NormalizedProviderError;
  reusesMerchantReference: boolean;
}): boolean {
  return args.capabilities.supportsIdempotentSessionCreation
    && args.reusesMerchantReference
    && args.error.retryMayBeSafe;
}
