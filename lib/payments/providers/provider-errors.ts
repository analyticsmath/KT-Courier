export const PROVIDER_FAILURE_CATEGORIES = [
  "INVALID_REQUEST",
  "AUTHENTICATION",
  "CONFIGURATION",
  "DECLINED",
  "RATE_LIMITED",
  "TIMEOUT",
  "NETWORK",
  "PROVIDER_UNAVAILABLE",
  "MALFORMED_RESPONSE",
  "UNKNOWN_OUTCOME",
  "UNKNOWN",
] as const;

export type PaymentProviderFailureCategory = (typeof PROVIDER_FAILURE_CATEGORIES)[number];

export type NormalizedProviderError = Readonly<{
  category: PaymentProviderFailureCategory;
  code: string;
  definitive: boolean;
  retryMayBeSafe: boolean;
  configurationFault: boolean;
  operatorMessage: string;
  customerMessage: string;
}>;

export class ProviderAdapterError extends Error {
  constructor(public readonly normalized: NormalizedProviderError, options?: { cause?: unknown }) {
    super(normalized.operatorMessage, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProviderAdapterError";
  }
}

export function normalizeProviderError(error: unknown): NormalizedProviderError {
  if (error instanceof ProviderAdapterError) return error.normalized;
  if ((error as { name?: string })?.name === "AbortError") {
    return Object.freeze({
      category: "TIMEOUT",
      code: "PROVIDER_CALL_TIMEOUT",
      definitive: false,
      retryMayBeSafe: false,
      configurationFault: false,
      operatorMessage: "The provider call timed out with an unknown outcome.",
      customerMessage: "Payment confirmation is still pending.",
    });
  }
  if (error instanceof TypeError) {
    return Object.freeze({
      category: "NETWORK",
      code: "PROVIDER_NETWORK_ERROR",
      definitive: false,
      retryMayBeSafe: false,
      configurationFault: false,
      operatorMessage: "The provider connection ended without a definitive outcome.",
      customerMessage: "Payment confirmation is still pending.",
    });
  }
  return Object.freeze({
    category: "UNKNOWN_OUTCOME",
    code: "PROVIDER_OUTCOME_UNKNOWN",
    definitive: false,
    retryMayBeSafe: false,
    configurationFault: false,
    operatorMessage: "The provider outcome could not be determined safely.",
    customerMessage: "Payment confirmation is still pending.",
  });
}

export function definitiveProviderError(
  category: Exclude<PaymentProviderFailureCategory, "TIMEOUT" | "NETWORK" | "UNKNOWN_OUTCOME" | "UNKNOWN">,
  code: string,
): NormalizedProviderError {
  const configurationFault = category === "AUTHENTICATION" || category === "CONFIGURATION";
  return Object.freeze({
    category,
    code,
    definitive: true,
    retryMayBeSafe: category === "RATE_LIMITED" || category === "PROVIDER_UNAVAILABLE",
    configurationFault,
    operatorMessage: configurationFault
      ? "Payment provider configuration requires attention."
      : "The payment provider rejected the session request.",
    customerMessage: category === "DECLINED"
      ? "The payment request was declined."
      : "A payment session could not be created.",
  });
}



/** Classify Paystack first-initialization failures without losing definitive
 * provider rejections. Only conditions known not to have initialized checkout
 * permit a new attempt. Network/timeout/malformed responses remain uncertain. */
export function normalizeCheckoutInitiationError(error: unknown): NormalizedProviderError {
  const code = (error as { code?: unknown })?.code;
  if (code === "PAYMENT_PROVIDER_AUTHENTICATION_FAILED") {
    return definitiveProviderError("AUTHENTICATION", code);
  }
  if (code === "PAYMENT_PROVIDER_REQUEST_INVALID" || code === "PAYMENT_CURRENCY_INVALID" || code === "PAYMENT_AMOUNT_INVALID") {
    return definitiveProviderError("INVALID_REQUEST", code);
  }
  if (code === "PAYMENT_PROVIDER_RATE_LIMITED") {
    return definitiveProviderError("RATE_LIMITED", code);
  }
  if (code === "PAYMENT_PROVIDER_UNAVAILABLE") {
    return Object.freeze({ category: "PROVIDER_UNAVAILABLE", code, definitive: false,
      retryMayBeSafe: false, configurationFault: false,
      operatorMessage: "Paystack initialization may have been accepted; reconcile this reference.",
      customerMessage: "Payment confirmation is still pending." });
  }
  if (code === "PAYMENT_PROVIDER_RESPONSE_INVALID" || code === "PAYMENT_PROVIDER_REFERENCE_CONFLICT") {
    return Object.freeze({ category: "MALFORMED_RESPONSE", code, definitive: false,
      retryMayBeSafe: false, configurationFault: false,
      operatorMessage: "Paystack response could not be validated; reconcile this reference.",
      customerMessage: "Payment confirmation is still pending." });
  }
  return normalizeProviderError(error);
}
