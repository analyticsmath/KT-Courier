import { PaymentError } from "../errors";
import { sanitizeProviderSnapshot } from "../provider-snapshot-policy";
import { validateProviderRedirectUrl } from "../redirect-url-policy";
import type { PaymentProviderAdapter, ProviderCheckoutSessionResult, ProviderCustomerAction } from "./payment-provider-adapter";

const SAFE_REFERENCE = /^[a-zA-Z0-9_.:-]{1,160}$/;
const SAFE_CODE = /^[a-zA-Z0-9_.:-]{1,80}$/;
const RESULT_STATUSES = new Set(["REQUIRES_ACTION", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"]);

export type ValidatedProviderResult = ProviderCheckoutSessionResult & Readonly<{
  safeMetadata?: ReturnType<typeof sanitizeProviderSnapshot>;
}>;

function validateCustomerAction(
  action: ProviderCustomerAction,
  adapter: PaymentProviderAdapter,
): ProviderCustomerAction {
  const url = validateProviderRedirectUrl(action.url, adapter.customerActionHosts, {
    allowHttpForInjectedTest: adapter.allowsHttpCustomerActionsForInjectedTests === true,
  });
  if (action.url !== url || !Object.isFrozen(action)) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider customer action is not canonical and immutable.");
  }
  if (action.expiresAt !== null && Number.isNaN(Date.parse(action.expiresAt))) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider action expiration time is invalid.");
  }
  if (action.type === "REDIRECT_GET") {
    if (!adapter.capabilities.supportsRedirectCheckout) {
      throw new PaymentError("PAYMENT_PROVIDER_CAPABILITY_UNSUPPORTED", "Provider returned an unsupported redirect action.");
    }
    return action;
  }
  if (!adapter.capabilities.supportsFormPostCheckout || !Object.isFrozen(action.fields)) {
    throw new PaymentError("PAYMENT_PROVIDER_CAPABILITY_UNSUPPORTED", "Provider returned an unsupported or mutable form action.");
  }
  const entries = Object.entries(action.fields);
  if (entries.length === 0 || entries.length > 32) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider form action contains an invalid field count.");
  }
  for (const [key, value] of entries) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key) || typeof value !== "string" || value.length > 2_048) {
      throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider form action contains an invalid field.");
    }
  }
  return action;
}

export function validateProviderResult(
  result: ProviderCheckoutSessionResult,
  adapter: PaymentProviderAdapter,
): ValidatedProviderResult {
  if (!result || typeof result !== "object") {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider returned an invalid response.");
  }
  if (!RESULT_STATUSES.has(result.status) || typeof result.definitive !== "boolean") {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider returned an unknown status or outcome flag.");
  }
  if (result.providerReference && !SAFE_REFERENCE.test(result.providerReference)) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider reference is invalid.");
  }
  if (result.providerStatusCode && !SAFE_CODE.test(result.providerStatusCode)) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider status code is invalid.");
  }
  if (result.status === "REQUIRES_ACTION" && !result.customerAction) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider action response omitted its customer action.");
  }
  if (result.status === "SUCCEEDED" && result.definitive !== true) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider success was not authoritative.");
  }
  if (result.providerTimestamp && (!(result.providerTimestamp instanceof Date) || Number.isNaN(result.providerTimestamp.getTime()))) {
    throw new PaymentError("PAYMENT_PROVIDER_RESPONSE_INVALID", "Provider timestamp is invalid.");
  }

  return Object.freeze({
    ...result,
    customerAction: result.customerAction ? validateCustomerAction(result.customerAction, adapter) : undefined,
    safeMetadata: sanitizeProviderSnapshot(result.safeMetadata),
  });
}
