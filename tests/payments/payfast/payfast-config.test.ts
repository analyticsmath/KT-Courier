import { describe, expect, it } from "vitest";
import { PAYFAST_PROCESSING_ENDPOINTS, resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";

const valid = {
  PAYFAST_MODE: "sandbox",
  PAYFAST_MERCHANT_ID: "merchant-id",
  PAYFAST_MERCHANT_KEY: "merchant-key",
  PAYFAST_PASSPHRASE: "private-passphrase",
  PAYFAST_CREDENTIAL_VERSION: "sandbox-v1",
  PAYMENT_PROXY_MODE: "single_trusted_proxy",
  PAYMENT_APP_ORIGIN: "https://app.example.test/",
};

describe("Payfast server configuration", () => {
  it("keeps disabled mode known and inactive", () => expect(resolvePayfastConfiguration({ PAYFAST_MODE: "disabled" }).state).toMatchObject({ configured: false, active: false, blockReason: "PAYFAST_DISABLED" }));
  it("activates complete sandbox configuration with a pinned endpoint", () => {
    const result = resolvePayfastConfiguration(valid);
    expect(result.state).toMatchObject({ configured: true, active: true, environment: "sandbox" });
    expect(result.runtime?.processingEndpoint).toBe(PAYFAST_PROCESSING_ENDPOINTS.sandbox);
  });
  it.each(["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE", "PAYFAST_CREDENTIAL_VERSION", "PAYMENT_APP_ORIGIN"])("fails closed when %s is missing", (key) => {
    expect(resolvePayfastConfiguration({ ...valid, [key]: undefined }).state).toMatchObject({ configured: false, active: false, errorCategory: "CONFIGURATION" });
  });
  it("keeps valid production configuration code-locked inactive", () => expect(resolvePayfastConfiguration({ ...valid, PAYFAST_MODE: "production" }).state).toMatchObject({ configured: true, active: false, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED", productionValidationApproved: false }));
  it("ignores arbitrary endpoint variables", () => expect(resolvePayfastConfiguration({ ...valid, PAYFAST_ENDPOINT: "https://attacker.invalid/process" }).runtime?.processingEndpoint).toBe(PAYFAST_PROCESSING_ENDPOINTS.sandbox));
  it.each(["http://app.example.test", "https://user:pass@app.example.test", "https://app.example.test/path", "not-a-url"])("rejects unsafe application origin %s", (origin) => expect(resolvePayfastConfiguration({ ...valid, PAYMENT_APP_ORIGIN: origin }).state.configured).toBe(false));
});
