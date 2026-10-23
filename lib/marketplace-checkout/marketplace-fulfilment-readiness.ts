import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

/**
 * A buyer must not be charged for a marketplace order that cannot enter the
 * vendor preparation / dispatch workflow. Never infer approval from a draft,
 * environment flag or the existence of past payments.
 */
export async function assertNewMarketplacePaymentPolicyReady(
  findEffectiveActivePolicy: () => Promise<{ id: string } | null>,
): Promise<void> {
  if (!await findEffectiveActivePolicy()) {
    throw new MarketplaceCheckoutError(
      "PAYMENT_PREPARATION_BLOCKED",
      "Marketplace checkout is temporarily unavailable while vendor fulfilment is being configured. No payment has been taken.",
    );
  }
}
