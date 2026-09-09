import { describe, expect, it, vi } from "vitest";

describe("Payment production registry", () => {
  it("reports valid sandbox active without exposing credentials", async () => {
    vi.stubEnv("PAYSTACK_MODE", "test");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_secret_key_123");
    vi.stubEnv("PAYSTACK_PUBLIC_KEY", "pk_test_public_key_123");
    vi.stubEnv("PAYMENT_APP_ORIGIN", "https://app.example.test");
    vi.resetModules();
    const { createProductionPaymentProviderRegistry } = await import("@/lib/payments/providers/payment-provider-registry");
    const registry = createProductionPaymentProviderRegistry();
    expect(registry.readiness()[0]).toMatchObject({
      code: "PAYSTACK",
      configured: true,
      active: true,
      environment: "sandbox",
      capabilities: { supportsRedirectCheckout: true, supportsAuthoritativeWebhookConfirmation: true },
    });

    expect(JSON.stringify(registry.readiness())).not.toMatch(/sk_test_secret_key_123/);
    vi.unstubAllEnvs();
  });

  it("throws PAYMENT_PROVIDER_NOT_SUPPORTED when requesting Payfast adapter", async () => {
    const { createProductionPaymentProviderRegistry } = await import("@/lib/payments/providers/payment-provider-registry");
    const registry = createProductionPaymentProviderRegistry();
    expect(() => registry.getAdapter("PAYFAST")).toThrowError(/no longer supported/);
  });
});


