import { createMarketplaceProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import type { MarketplacePaymentPreparationResult } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

/**
 * Phase 11 composition keeps PayFast credentials, merchant references,
 * signatures and provider interaction inside the established session service.
 * No Phase 20 code signs a form or stores secrets.
 */
export async function prepareMarketplacePayfastCustomerAction(input: Readonly<{
  paymentId: string;
  paymentReference: string;
  payerEmail: string;
  operationId: string;
  guestCheckoutEvidence: boolean;
}>): Promise<MarketplacePaymentPreparationResult["providerAction"]> {
  const session = await createMarketplaceProviderCheckoutSession({ paymentId: input.paymentId, idempotencyKey: input.operationId, payerEmail: input.payerEmail, guestCheckoutEvidence: input.guestCheckoutEvidence });
  if (!session.attempt.publicReference || session.attempt.checkoutActionType !== "FORM_POST") {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "PayFast did not return a safe customer checkout action.");
  }
  // The existing PayFast checkout page resolves the signed form from the
  // persisted Phase 11 attempt. Returning a local route avoids exposing a
  // signature or provider credential in marketplace checkout evidence.
  return Object.freeze({ type: "FORM_POST" as const, endpoint: `/payments/payfast/checkout/${encodeURIComponent(session.attempt.publicReference)}`, fields: Object.freeze({}) });
}
