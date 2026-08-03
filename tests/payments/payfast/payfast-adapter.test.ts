import { describe, expect, it } from "vitest";
import { PayfastAdapter } from "@/lib/payments/providers/payfast/payfast-adapter";
import { checkoutInput, sandboxConfig } from "./payfast-test-fixtures";

describe("Payfast adapter", () => {
  it("returns an immutable sandbox FORM_POST action with no provider reference or network call", async () => {
    const result = await new PayfastAdapter(sandboxConfig).createCheckoutSession(checkoutInput, { signal: new AbortController().signal, correlationId: "attempt", timeoutMs: 1000 });
    expect(result).toMatchObject({ status: "REQUIRES_ACTION", definitive: false, providerStatusCode: "CHECKOUT_FORM_READY", customerAction: { type: "FORM_POST", url: "https://sandbox.payfast.co.za/eng/process", expiresAt: null }, safeMetadata: { environment: "sandbox", signatureVersion: "payfast-md5-v1", requestFieldVersion: "payfast-custom-checkout-v1" } });
    expect(result.providerReference).toBeUndefined();
    expect(result.customerAction && "fields" in result.customerAction ? result.customerAction.fields : {}).not.toHaveProperty("passphrase");
  });
  it("code-locks direct production construction", async () => {
    const adapter = new PayfastAdapter({ ...sandboxConfig, mode: "production", environment: "production", processingEndpoint: "https://www.payfast.co.za/eng/process", configurationFingerprint: "payfast-v1:production" });
    await expect(adapter.createCheckoutSession(checkoutInput, { signal: new AbortController().signal, correlationId: "attempt", timeoutMs: 1000 })).rejects.toMatchObject({ code: "PAYFAST_PRODUCTION_NOT_READY" });
  });
});
