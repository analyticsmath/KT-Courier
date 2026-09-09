import { PaymentError } from "../../errors";

const PAYMENT_REFERENCE = /^pay_[A-Za-z0-9_-]{12,80}$/;

export type PaystackCallbackUrls = Readonly<{
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  returnRouteId: "paystack-return";
  cancelRouteId: "paystack-cancel";
  notificationRouteId: "paystack-webhook";
}>;

export function buildPaystackCallbackUrls(appOrigin: string, paymentPublicReference: string): PaystackCallbackUrls {
  if (!PAYMENT_REFERENCE.test(paymentPublicReference)) {
    throw new PaymentError("PAYMENT_CALLBACK_URL_INVALID", "Payment callback reference is invalid.");
  }
  let origin: URL;
  try {
    origin = new URL(appOrigin);
  } catch {
    throw new PaymentError("PAYMENT_CALLBACK_URL_INVALID", "Payment callback origin is invalid.");
  }
  const isHttpAllowed = origin.protocol === "http:" && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1" || process.env.KT_RUNTIME_ENV === "e2e");
  if ((origin.protocol !== "https:" && !isHttpAllowed) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new PaymentError("PAYMENT_CALLBACK_URL_INVALID", "Payment callback origin failed the safety policy.");
  }
  const query = `payment=${encodeURIComponent(paymentPublicReference)}`;
  return Object.freeze({
    returnUrl: new URL(`/payments/paystack/return?${query}`, origin).toString(),
    cancelUrl: new URL(`/payments/paystack/return?${query}&status=cancelled`, origin).toString(),
    notificationUrl: new URL("/api/payments/paystack/webhook", origin).toString(),
    returnRouteId: "paystack-return",
    cancelRouteId: "paystack-cancel",
    notificationRouteId: "paystack-webhook",
  });
}
