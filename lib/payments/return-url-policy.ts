import { PaymentError } from "./errors";
import { buildPayfastCallbackUrls } from "./providers/payfast/payfast-callback-urls";

export type PaymentCallbackUrls = Readonly<{
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  returnRouteId: "payfast-return";
  cancelRouteId: "payfast-cancel";
  notificationRouteId: "payfast-itn-reserved";
}>;

export function buildServerPaymentCallbackUrls(publicReference: string): PaymentCallbackUrls {
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
  return buildPayfastCallbackUrls(origin.origin, publicReference);
}
