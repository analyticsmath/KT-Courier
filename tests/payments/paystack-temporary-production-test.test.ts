import { describe, expect, it } from "vitest";
import { resolvePaystackConfiguration, resolvePaystackWebhookSecretKey, resolvePaystackStoredEventSecretKey } from "@/lib/payments/providers/paystack/paystack-config";
import { isLiveMoneyAllowed } from "@/lib/runtime/deployment-classification";
import { evaluateProductionConfiguration } from "@/lib/config/production-validation";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";

const source = {
  NODE_ENV: "production",
  KT_DATABASE_CLASSIFICATION: "production",
  PAYSTACK_MODE: "live",
  PAYSTACK_SECRET_KEY: "sk_live_original_should_remain_untouched",
  PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
  CHECKOUT_PUBLIC_ENABLED: "false",
  PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
  PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY: "sk_test_temporary_dummy_secret",
  PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY: "pk_test_temporary_dummy_public",
};
const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
describe("temporary sandbox on the existing production site", () => {
  it("selects sandbox keys for a narrowly time-boxed production test", () => {
    const env = { ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: future() };
    const resolution = resolvePaystackConfiguration(env);
    expect(resolution.runtime).toMatchObject({ mode: "test", environment: "sandbox", secretKey: source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY });
    expect(resolution.state.active).toBe(true);
    expect(evaluateMarketplaceCheckoutPublicGate(env).enabled).toBe(true);
  });
  it("does not activate if the deadline is absent, expired, invalid, or beyond six hours", () => {
    for (const until of [undefined, "2020-01-01T00:00:00Z", "invalid", new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString()]) {
      const env = { ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: until };
      const r = resolvePaystackConfiguration(env);
      expect(r.runtime).toBeNull();
      expect(evaluateMarketplaceCheckoutPublicGate(env).enabled).toBe(false);
    }
  });
  it("never silently switches to live money when test mode expires", () => {
    const expired = { ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: "2020-01-01T00:00:00Z", CHECKOUT_PUBLIC_ENABLED: "true" };
    expect(resolvePaystackConfiguration(expired).runtime).toBeNull();
  });
  it("rejects an invalid test key pair and preserves the original production guard", () => {
    const until = future();
    expect(resolvePaystackConfiguration({ ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: until, PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY: "sk_live_wrong" }).runtime).toBeNull();
    expect(resolvePaystackConfiguration({ ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: until, PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY: "pk_live_wrong" }).runtime).toBeNull();
    expect(resolvePaystackConfiguration({ ...source, PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false", PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "sk_test_wrong" }).runtime).toBeNull();
  });
  it("uses sandbox credentials for webhook verification and disables real payouts", () => {
    const env = { ...source, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: future() };
    expect(resolvePaystackWebhookSecretKey(env)).toBe(source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY);
    expect(isLiveMoneyAllowed(env, true)).toBe(false);
    const expired = { ...env, PAYSTACK_TEMPORARY_SANDBOX_UNTIL: "2020-01-01T00:00:00Z" };
    expect(resolvePaystackWebhookSecretKey(expired)).toBeNull();
  });
  it("does not wrongly reject a valid sandbox as missing live credentials in readiness", () => {
    const env = { ...source, CHECKOUT_PUBLIC_ENABLED: "true", PAYSTACK_TEMPORARY_SANDBOX_UNTIL: future() };
    expect(evaluateProductionConfiguration(env).issues.filter(issue => issue.capability === "checkout")).toEqual([]);
  });
  it("keeps normal live mode untouched when override is off", () => {
    const r = resolvePaystackConfiguration({ ...source, PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false", CHECKOUT_PUBLIC_ENABLED: "true" });
    expect(r.runtime).toMatchObject({ mode: "live", environment: "production", secretKey: source.PAYSTACK_SECRET_KEY });
  });
});

describe("stored Paystack event verification across sandbox-to-live cutover", () => {
  const live = { ...source, PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false", PAYSTACK_TEMPORARY_SANDBOX_UNTIL: "2020-01-01T00:00:00Z", CHECKOUT_PUBLIC_ENABLED: "true" };
  it("retains test verification for already signed durable events without reopening sandbox intake", () => {
    expect(resolvePaystackWebhookSecretKey(live)).toBe(source.PAYSTACK_SECRET_KEY);
    expect(resolvePaystackStoredEventSecretKey("SANDBOX", true, live)).toBe(source.PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY);
    expect(resolvePaystackConfiguration(live).runtime?.environment).toBe("production");
  });
  it("never selects a key from the other payment environment or trusts an unsigned event", () => {
    expect(resolvePaystackStoredEventSecretKey("SANDBOX", false, live)).toBeNull();
    expect(resolvePaystackStoredEventSecretKey("PRODUCTION", true, live)).toBe(source.PAYSTACK_SECRET_KEY);
    expect(resolvePaystackStoredEventSecretKey("SANDBOX", true, { ...live, PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY: undefined })).toBeNull();
    expect(resolvePaystackStoredEventSecretKey("PRODUCTION", true, { ...live, PAYSTACK_SECRET_KEY: "sk_test_not_live" })).toBeNull();
  });
});
