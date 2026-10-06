import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntegrationRegistry, getReadinessLockRegistry } from "@/lib/security/integration-registry";

describe("Integration Registry Truthfulness", () => {
  afterEach(() => vi.unstubAllEnvs());

  function configureProductionPaystack() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KT_DATABASE_CLASSIFICATION", "production");
    vi.stubEnv("PAYSTACK_MODE", "live");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_release_contract_fixture");
    vi.stubEnv("PAYMENT_APP_ORIGIN", "https://ktcouriers.com");
    vi.stubEnv("CHECKOUT_PUBLIC_ENABLED", "true");
  }

  it("does not advertise live payments before checkout activation", () => {
    configureProductionPaystack();
    vi.stubEnv("CHECKOUT_PUBLIC_ENABLED", "false");
    const payment = getIntegrationRegistry().find((item) => item.id === "paystack");
    expect(payment).toMatchObject({ readiness: "ACTIVATION_PENDING", productionEligible: false });
  });

  it("rejects a test key in production and reports the actual missing variable", () => {
    configureProductionPaystack();
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_release_contract_fixture");
    expect(getIntegrationRegistry().find((item) => item.id === "paystack")).toMatchObject({ readiness: "CREDENTIAL_PENDING", productionEligible: false });
    vi.stubEnv("PAYSTACK_SECRET_KEY", "");
    expect(getIntegrationRegistry().find((item) => item.id === "paystack")?.missingEnvVars).toContain("PAYSTACK_SECRET_KEY");
  });

  it("requires a valid HTTPS origin before declaring production eligible", () => {
    configureProductionPaystack();
    vi.stubEnv("PAYMENT_APP_ORIGIN", "http://localhost:3000");
    expect(getIntegrationRegistry().find((item) => item.id === "paystack")?.productionEligible).toBe(false);
    vi.stubEnv("PAYMENT_APP_ORIGIN", "https://ktcouriers.com");
    expect(getIntegrationRegistry().find((item) => item.id === "paystack")).toMatchObject({ readiness: "LIVE_READY", productionEligible: true });
  });
  it("contains no ambiguous PARTIAL readiness states", () => {
    const registry = getIntegrationRegistry();

    for (const record of registry) {
      expect(record.readiness).not.toBe("PARTIAL");
      expect([
        "LIVE_READY",
        "SANDBOX_READY",
        "MOCK_READY",
        "CREDENTIAL_PENDING",
        "ACTIVATION_PENDING",
        "DISABLED",
        "NOT_IMPLEMENTED",
      ]).toContain(record.readiness);
    }
  });

  it("projects consistent readiness lock records", () => {
    const locks = getReadinessLockRegistry();
    expect(locks.length).toBeGreaterThan(0);

    for (const lock of locks) {
      expect([
        "READY",
        "SOURCE_COMPLETE_FINAL_VALIDATION_PENDING",
        "CREDENTIAL_PENDING",
        "INFRASTRUCTURE_PENDING",
        "PROVIDER_APPROVAL_PENDING",
        "DISABLED_BY_POLICY",
        "DEGRADED",
        "UNAVAILABLE",
      ]).toContain(lock.state);
    }
  });
});
