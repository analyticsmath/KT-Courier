import { createMarketplaceProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import type { MarketplacePaymentPreparationResult } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import type { PaymentChannel } from "@/lib/payments/providers/payment-provider-adapter";

export async function prepareMarketplacePaystackCustomerAction(input: Readonly<{
  paymentId: string;
  paymentReference: string;
  payerEmail: string;
  operationId: string;
  guestCheckoutEvidence: boolean;
  channel?: PaymentChannel;
}>): Promise<MarketplacePaymentPreparationResult["providerAction"]> {
  const session = await createMarketplaceProviderCheckoutSession({
    paymentId: input.paymentId,
    idempotencyKey: input.operationId,
    payerEmail: input.payerEmail,
    guestCheckoutEvidence: input.guestCheckoutEvidence,
    ...(input.channel ? { channel: input.channel } : {}),
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

  throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Paystack did not return a safe customer checkout action.");
}
