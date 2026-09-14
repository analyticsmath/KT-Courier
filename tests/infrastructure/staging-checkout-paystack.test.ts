import { describe, it, expect } from "vitest";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";

describe("Staging Checkout & Paystack Configuration Matrix", () => {
  const validStagingBase = {
    NODE_ENV: "production",
    KT_RUNTIME_ENV: "staging-demo",
    KT_STAGING_DEMO_ENABLED: "true",
    DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
    PAYMENT_APP_ORIGIN: "https://staging.ktcourier.co.za",
    CHECKOUT_PUBLIC_ENABLED: "true",
    PAYSTACK_CREDENTIAL_VERSION: "staging-v1",
  };

  const DUMMY_LIVE_SECRET = ["sk", "live", "mock_dummy_testing_secret_key"].join("_");
  const DUMMY_LIVE_PUBLIC = ["pk", "live", "mock_dummy_testing_public_key"].join("_");
  const DUMMY_TEST_SECRET = ["sk", "test", "mock_dummy_testing_secret_key"].join("_");
  const DUMMY_TEST_PUBLIC = ["pk", "test", "mock_dummy_testing_public_key"].join("_");

  describe("Paystack Test vs Live Configuration Rules", () => {
    it("accepts valid test configuration with test key prefix in staging", () => {
      const res = resolvePaystackConfiguration({
        ...validStagingBase,
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: DUMMY_TEST_SECRET,
        PAYSTACK_PUBLIC_KEY: DUMMY_TEST_PUBLIC,
      });
      expect(res.state.configured).toBe(true);
      expect(res.state.active).toBe(true);
      expect(res.state.environment).toBe("sandbox");
      expect(res.runtime?.mode).toBe("test");
      expect(res.runtime?.environment).toBe("sandbox");
    });

    it("strictly rejects live key under test mode", () => {
      const res = resolvePaystackConfiguration({
        ...validStagingBase,
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: DUMMY_LIVE_SECRET,
        PAYSTACK_PUBLIC_KEY: DUMMY_TEST_PUBLIC,
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.state.blockReason).toBe("CONFIGURATION_INVALID");
      expect(res.runtime).toBeNull();
    });

    it("strictly rejects test key under live mode", () => {
      const res = resolvePaystackConfiguration({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_live",
        PAYMENT_APP_ORIGIN: "https://ktcourier.co.za",
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_CREDENTIAL_VERSION: "prod-v1",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: DUMMY_TEST_SECRET,
        PAYSTACK_PUBLIC_KEY: DUMMY_LIVE_PUBLIC,
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.runtime).toBeNull();
    });

    it("strictly rejects placeholder or empty keys", () => {
      const res = resolvePaystackConfiguration({
        ...validStagingBase,
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "<injected-by-deployment-environment>",
        PAYSTACK_PUBLIC_KEY: "<injected-by-deployment-environment>",
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.runtime).toBeNull();
    });
  });

  describe("Staging-Demo Sandbox Isolation", () => {
    it("strictly rejects PAYSTACK_MODE=live in staging-demo to prevent live money processing", () => {
      const res = resolvePaystackConfiguration({
        ...validStagingBase,
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: DUMMY_LIVE_SECRET,
        PAYSTACK_PUBLIC_KEY: DUMMY_LIVE_PUBLIC,
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.state.blockReason).toBe("CONFIGURATION_INVALID");
      expect(res.runtime).toBeNull();
    });

    it("strictly rejects live mode in local-demo as well", () => {
      const res = resolvePaystackConfiguration({
        NODE_ENV: "development",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: DUMMY_LIVE_SECRET,
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.runtime).toBeNull();
    });
  });

  describe("Production Live Requirement", () => {
    it("strictly rejects PAYSTACK_MODE=test in production environment", () => {
      const res = resolvePaystackConfiguration({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_live",
        PAYMENT_APP_ORIGIN: "https://ktcourier.co.za",
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_CREDENTIAL_VERSION: "prod-v1",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: DUMMY_TEST_SECRET,
      });
      expect(res.state.configured).toBe(false);
      expect(res.state.active).toBe(false);
      expect(res.state.blockReason).toBe("CONFIGURATION_INVALID");
      expect(res.runtime).toBeNull();
    });

    it("accepts valid live configuration with live key and HTTPS origin in production", () => {
      const res = resolvePaystackConfiguration({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_live",
        PAYMENT_APP_ORIGIN: "https://ktcourier.co.za",
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_CREDENTIAL_VERSION: "prod-v1",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: DUMMY_LIVE_SECRET,
        PAYSTACK_PUBLIC_KEY: DUMMY_LIVE_PUBLIC,
      });
      expect(res.state.configured).toBe(true);
      expect(res.state.active).toBe(true);
      expect(res.state.environment).toBe("production");
      expect(res.runtime?.mode).toBe("live");
      expect(res.runtime?.environment).toBe("production");
    });
  });
});
