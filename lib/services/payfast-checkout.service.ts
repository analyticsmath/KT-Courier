/* eslint-disable @typescript-eslint/no-unused-vars */
import { PaymentError } from "@/lib/payments/errors";

import type { ProviderCustomerAction } from "@/lib/payments/providers/payment-provider-adapter";
import type { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import type { PaymentCallbackUrls } from "@/lib/payments/return-url-policy";

type CheckoutDependencies = Readonly<{
  registry?: PaymentProviderRegistry;
  callbackUrls?: (paymentPublicReference: string) => PaymentCallbackUrls;
}>;

export async function buildOwnedPayfastCheckoutAction(
  _payerId: string,
  _attemptReference: string,
  _dependencies: CheckoutDependencies = {},
): Promise<ProviderCustomerAction & { type: "FORM_POST" }> {
  throw new PaymentError(
    "PAYMENT_PROVIDER_NOT_SUPPORTED",
    "PayFast checkout is no longer supported. Please proceed with Paystack payment.",
  );
}


