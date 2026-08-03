import { describe, expect, it } from "vitest";
import { PAYFAST_PRODUCTION_VALIDATION_APPROVED, resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
describe("Payfast Phase 12 production readiness", () => {
  it("implements verification but keeps production code-locked", () => {
    const state = resolvePayfastConfiguration({ PAYFAST_MODE: "production", PAYFAST_MERCHANT_ID: "id", PAYFAST_MERCHANT_KEY: "key", PAYFAST_PASSPHRASE: "pass", PAYFAST_CREDENTIAL_VERSION: "prod-v1", PAYMENT_PROXY_MODE: "single_trusted_proxy", PAYMENT_APP_ORIGIN: "https://app.example.test" }).state;
    expect(PAYFAST_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(state).toMatchObject({ configured: true, active: false, itnVerificationImplemented: true, sourceAddressTrustConfigured: true, productionValidationApproved: false, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  });
});
