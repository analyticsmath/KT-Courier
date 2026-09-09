/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MarketplacePaymentPreparationResult } from "@/lib/marketplace-checkout/marketplace-payment-preparation.service";

import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

/**
 * PayFast checkout has been retired and tombstoned.
 * All live customer checkouts are processed exclusively through Paystack.
 */
export async function prepareMarketplacePayfastCustomerAction(_input: Readonly<{
  paymentId: string;
  paymentReference: string;
  payerEmail: string;
  operationId: string;
  guestCheckoutEvidence: boolean;
}>): Promise<MarketplacePaymentPreparationResult["providerAction"]> {
  throw new MarketplaceCheckoutError(
    "PAYMENT_PREPARATION_BLOCKED",
    "PayFast checkout is no longer supported. Please proceed with Paystack payment."
  );
}

