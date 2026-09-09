import { createMarketplaceProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import type { MarketplacePaymentPreparationResult } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

export async function prepareMarketplacePaystackCustomerAction(input: Readonly<{
  paymentId: string;
  paymentReference: string;
  payerEmail: string;
  operationId: string;
  guestCheckoutEvidence: boolean;
}>): Promise<MarketplacePaymentPreparationResult["providerAction"]> {
  const session = await createMarketplaceProviderCheckoutSession({
    paymentId: input.paymentId,
    idempotencyKey: input.operationId,
    payerEmail: input.payerEmail,
    guestCheckoutEvidence: input.guestCheckoutEvidence,
  });

  if (!session.attempt.publicReference) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Paystack did not return a valid payment attempt.");
  }

  if (session.attempt.checkoutActionType === "REDIRECT_GET" && session.attempt.redirectUrl) {
    return Object.freeze({
      type: "REDIRECT_GET" as const,
      endpoint: session.attempt.redirectUrl,
    });
  }

  if (session.attempt.checkoutActionType === "FORM_POST") {
    return Object.freeze({
      type: "FORM_POST" as const,
      endpoint: `/payments/payfast/checkout/${encodeURIComponent(session.attempt.publicReference)}`,
      fields: Object.freeze({}),
    });
  }

  throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Paystack did not return a safe customer checkout action.");
}
