import { describe, expect, it } from "vitest";
import { validateProviderResult } from "@/lib/payments/providers/provider-result-validation";
import { FakePaymentProvider } from "./fake-payment-provider";
describe("provider result validation", () => {
  it("validates allowlisted redirects and sanitized output", () => expect(validateProviderResult({ status: "REQUIRES_ACTION", customerAction: Object.freeze({ type: "REDIRECT_GET", url: "https://checkout.test.ktcouriers.local/x", expiresAt: null }), definitive: true }, new FakePaymentProvider("requires-action"))).toMatchObject({ status: "REQUIRES_ACTION" }));
  it("rejects action without redirect and non-authoritative success", () => { const fake = new FakePaymentProvider("processing"); expect(() => validateProviderResult({ status: "REQUIRES_ACTION", definitive: true }, fake)).toThrow(); expect(() => validateProviderResult({ status: "SUCCEEDED", definitive: false }, fake)).toThrow(); });
});
