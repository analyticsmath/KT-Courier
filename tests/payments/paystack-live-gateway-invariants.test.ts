import { describe, expect, it } from "vitest";
import { normalizeCheckoutInitiationError } from "@/lib/payments/providers/provider-errors";
import { PaymentError } from "@/lib/payments/errors";
import { resolveLiveGatewayVerificationConfiguration, LIVE_GATEWAY_VERIFICATION_CENTS } from "@/lib/payments/live-gateway-verification.service";

describe("real-money gateway verification safety", () => {
  const env = {
    NODE_ENV: "production", KT_DATABASE_CLASSIFICATION: "production",
    PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_live_testfixture_not_a_real_key",
    PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false",
    PAYMENT_APP_ORIGIN: "https://ktcouriers.com",
    CHECKOUT_PUBLIC_ENABLED: "false",
  };
  it("uses Paystack's documented ZAR minimum, without turning on public payment checkout", () => {
    expect(LIVE_GATEWAY_VERIFICATION_CENTS).toBe(100);
    expect(resolveLiveGatewayVerificationConfiguration(env).eligible).toBe(true);
  });
  it.each([
    { KT_E2E_PAYSTACK_ACCEPTANCE: "true" },
    { PAYSTACK_MODE: "test" },
    { PAYSTACK_SECRET_KEY: "sk_test_wrong" },
    { PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true" },
    { PAYMENT_APP_ORIGIN: "https://attacker.example" },
    { PAYMENT_APP_ORIGIN: "http://ktcouriers.com" },
    { KT_DATABASE_CLASSIFICATION: "staging-demo" },
  ])("refuses unsafe live-verification configuration: %o", async override => {
    expect(resolveLiveGatewayVerificationConfiguration({ ...env, ...override }).eligible).toBe(false);
  });
  it("marks explicit authentication and rejected-request faults definitive", () => {
    for (const code of ["PAYMENT_PROVIDER_AUTHENTICATION_FAILED", "PAYMENT_PROVIDER_REQUEST_INVALID"] as const) {
      const result = normalizeCheckoutInitiationError(new PaymentError(code, "Provider denied request"));
      expect(result.definitive).toBe(true);
      expect(result.code).toBe(code);
    }
  });
  it("preserves unknown outcomes for network failures, malformed responses and timeouts", () => {
    for (const code of ["PAYMENT_PROVIDER_UNAVAILABLE", "PAYMENT_PROVIDER_RESPONSE_INVALID"] as const) {
      const result = normalizeCheckoutInitiationError(new PaymentError(code, "Unknown outcome", true));
      expect(result.definitive).toBe(false);
      expect(result.code).toBe(code);
    }
    expect(normalizeCheckoutInitiationError(new TypeError("network")).definitive).toBe(false);
  });
});
