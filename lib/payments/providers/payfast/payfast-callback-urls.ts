import { PaymentError } from "../../errors";

const PAYMENT_REFERENCE = /^pay_[A-Za-z0-9_-]{12,80}$/;

export type PayfastCallbackUrls = Readonly<{
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  returnRouteId: "payfast-return";
  cancelRouteId: "payfast-cancel";
  notificationRouteId: "payfast-itn-reserved";
}>;

export function buildPayfastCallbackUrls(appOrigin: string, paymentPublicReference: string): PayfastCallbackUrls {
  if (!PAYMENT_REFERENCE.test(paymentPublicReference)) {
    throw new PaymentError("PAYFAST_CALLBACK_URL_INVALID", "Payfast callback payment reference is invalid.");
  }
  let origin: URL;
  try {
    origin = new URL(appOrigin);
  } catch {
    throw new PaymentError("PAYFAST_CALLBACK_URL_INVALID", "Payfast callback origin is invalid.");
  }
  const isHttpAllowed = origin.protocol === "http:" && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || process.env.KT_RUNTIME_ENV === "e2e");
  if ((origin.protocol !== "https:" && !isHttpAllowed) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new PaymentError("PAYFAST_CALLBACK_URL_INVALID", "Payfast callback origin failed the safety policy.");
  }
  const query = `payment=${encodeURIComponent(paymentPublicReference)}`;
  return Object.freeze({
    returnUrl: new URL(`/payments/payfast/return?${query}`, origin).toString(),
    cancelUrl: new URL(`/payments/payfast/cancel?${query}`, origin).toString(),
    notificationUrl: new URL("/api/payments/payfast/itn", origin).toString(),
    returnRouteId: "payfast-return",
    cancelRouteId: "payfast-cancel",
    notificationRouteId: "payfast-itn-reserved",
  });
}
