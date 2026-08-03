import { describe, expect, it, vi } from "vitest";

describe("Payfast production registry", () => {
  it("reports valid sandbox active without exposing credentials", async () => {
    vi.stubEnv("PAYFAST_MODE", "sandbox"); vi.stubEnv("PAYFAST_MERCHANT_ID", "merchant-id"); vi.stubEnv("PAYFAST_MERCHANT_KEY", "merchant-key"); vi.stubEnv("PAYFAST_PASSPHRASE", "private-passphrase"); vi.stubEnv("PAYFAST_CREDENTIAL_VERSION", "v1"); vi.stubEnv("PAYMENT_APP_ORIGIN", "https://app.example.test");
    vi.resetModules();
    const { createProductionPaymentProviderRegistry } = await import("@/lib/payments/providers/payment-provider-registry");
    const registry = createProductionPaymentProviderRegistry();
    expect(registry.readiness()[0]).toMatchObject({ configured: true, active: true, environment: "sandbox", capabilities: { supportsFormPostCheckout: true, supportsAuthoritativeWebhookConfirmation: false } });
    expect(JSON.stringify(registry.readiness())).not.toMatch(/merchant-id|merchant-key|private-passphrase/);
    vi.unstubAllEnvs();
  });
});
