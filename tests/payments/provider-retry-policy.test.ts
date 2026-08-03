import { describe, expect, it } from "vitest";
import { mayRetryProviderSession } from "@/lib/payments/providers/provider-retry-policy";

const capabilities = { supportsRedirectCheckout: true, supportsFormPostCheckout: false, supportsStatusLookup: false, supportsIdempotentSessionCreation: true, supportsCancellation: false, supportsAuthorizationCapture: false, supportsAuthoritativeWebhookConfirmation: false };
const error = { category: "NETWORK" as const, code: "N", definitive: false, retryMayBeSafe: true, configurationFault: false, operatorMessage: "safe", customerMessage: "safe" };
describe("provider retry policy", () => {
  it("requires explicit external idempotency, same merchant reference, and safe classification", () => expect(mayRetryProviderSession({ capabilities, error, reusesMerchantReference: true })).toBe(true));
  it("does not retry blind or policy-forbidden failures", () => { expect(mayRetryProviderSession({ capabilities: { ...capabilities, supportsIdempotentSessionCreation: false }, error, reusesMerchantReference: true })).toBe(false); expect(mayRetryProviderSession({ capabilities, error: { ...error, category: "DECLINED", definitive: true, retryMayBeSafe: false }, reusesMerchantReference: true })).toBe(false); });
});
