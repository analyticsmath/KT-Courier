import type { ProviderCheckoutSessionInput } from "../payment-provider-adapter";
import { PaymentError } from "../../errors";
import type { PayfastRuntimeConfiguration } from "./payfast-config";
import type { PayfastCheckoutFields, PayfastUnsignedFields } from "./payfast-fields";
import { buildSignedPayfastForm } from "./payfast-signature";

const ORDER_REFERENCE = /^[A-Za-z0-9_.-]{1,60}$/;

function payerNames(name: string | undefined): { first: string; last?: string } {
  const normalized = name?.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!normalized) return { first: "Customer" };
  const [first, ...rest] = normalized.split(" ");
  return { first: first || "Customer", ...(rest.length ? { last: rest.join(" ") } : {}) };
}

function assertCallbackUrl(candidate: string, expectedOrigin: string): string {
  try {
    const url = new URL(candidate);
    const isHttpAllowed = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || process.env.KT_RUNTIME_ENV === "e2e");
    if (
      (url.protocol !== "https:" && !isHttpAllowed) || url.origin !== expectedOrigin || url.username || url.password || url.hash || candidate.length > 2_048
    ) throw new Error();
    return url.toString();
  } catch {
    throw new PaymentError("PAYFAST_CALLBACK_URL_INVALID", "Payfast callback URL failed the safety policy.");
  }
}

export function buildPayfastCheckoutRequest(
  input: ProviderCheckoutSessionInput,
  configuration: PayfastRuntimeConfiguration,
): PayfastCheckoutFields {
  if (input.currency !== "ZAR" || !/^\d+\.\d{2}$/.test(input.amount) || input.amount === "0.00") {
    throw new PaymentError("PAYFAST_FIELD_INVALID", "Payfast requires an exact positive ZAR amount.");
  }
  if (!ORDER_REFERENCE.test(input.orderReference)) {
    throw new PaymentError("PAYFAST_FIELD_INVALID", "Payfast order reference is invalid.");
  }
  const names = payerNames(input.customerName);
  const unsigned: PayfastUnsignedFields = {
    merchant_id: configuration.merchantId,
    merchant_key: configuration.merchantKey,
    return_url: assertCallbackUrl(input.returnUrl, configuration.appOrigin),
    cancel_url: assertCallbackUrl(input.cancelUrl, configuration.appOrigin),
    notify_url: assertCallbackUrl(input.notificationUrl, configuration.appOrigin),
    name_first: names.first,
    ...(names.last ? { name_last: names.last } : {}),
    email_address: input.customerEmail.trim().toLowerCase(),
    m_payment_id: input.merchantReference,
    amount: input.amount,
    item_name: `KT Courier Order ${input.orderReference}`.slice(0, 100),
    item_description: "Courier service payment",
  };
  return buildSignedPayfastForm(unsigned, configuration.passphrase);
}
