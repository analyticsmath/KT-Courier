import { PaymentError } from "./errors";
import type { PaymentProviderCode } from "./types";
import { buildPayfastCallbackUrls } from "./providers/payfast/payfast-callback-urls";
import { buildPaystackCallbackUrls } from "./providers/paystack/paystack-callback-urls";

export type PaymentCallbackUrls = Readonly<{
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  returnRouteId: "payfast-return" | "paystack-return";
  cancelRouteId: "payfast-cancel" | "paystack-cancel";
  notificationRouteId: "payfast-itn-reserved" | "paystack-webhook";
}>;

export function buildServerPaymentCallbackUrls(
  publicReference: string,
  provider: PaymentProviderCode = "PAYSTACK",
): PaymentCallbackUrls {
  const configuredOrigin = process.env.PAYMENT_APP_ORIGIN;
  if (!configuredOrigin) {
    throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Server payment callback origin is not configured.");
  }
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Server payment callback origin is invalid.");
  }
  const isHttpAllowed = origin.protocol === "http:" && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || process.env.KT_RUNTIME_ENV === "e2e");
  if ((origin.protocol !== "https:" && !isHttpAllowed) || origin.username || origin.password || origin.pathname !== "/") {
    throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Server payment callback origin failed the safety policy.");
  }
  if (provider === "PAYFAST") {
    return buildPayfastCallbackUrls(origin.origin, publicReference);
  }
  return buildPaystackCallbackUrls(origin.origin, publicReference);
}
