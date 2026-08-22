import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAYFAST_PRODUCTION_VALIDATION_APPROVED, resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
import { assertSeedExecutionAllowed, SeedSafetyError } from "@/lib/security/seed-safety";

describe("Payfast Phase 12 production readiness", () => {
  it("implements verification but keeps production code-locked", () => {
    const state = resolvePayfastConfiguration({ PAYFAST_MODE: "production", PAYFAST_MERCHANT_ID: "id", PAYFAST_MERCHANT_KEY: "key", PAYFAST_PASSPHRASE: "pass", PAYFAST_CREDENTIAL_VERSION: "prod-v1", PAYMENT_PROXY_MODE: "single_trusted_proxy", PAYMENT_APP_ORIGIN: "https://app.example.test" }).state;
    expect(PAYFAST_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(state).toMatchObject({ configured: true, active: false, itnVerificationImplemented: true, sourceAddressTrustConfigured: true, productionValidationApproved: false, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" });
  });

  it("verifies both PayFast disposable integration runners own deterministic seed authorization", () => {
    const phase11Runner = readFileSync("scripts/payfast-integration-test.mjs", "utf8");
    const phase12Runner = readFileSync("scripts/payfast-confirmation-integration-test.mjs", "utf8");
    const composeConfig = readFileSync("compose.yml", "utf8");

    // Both disposable runners must explicitly provide KT_ALLOW_DEMO_SEED: "true"
    expect(phase11Runner).toMatch(/KT_ALLOW_DEMO_SEED:\s*["']true["']/);
    expect(phase12Runner).toMatch(/KT_ALLOW_DEMO_SEED:\s*["']true["']/);

    // compose.yml must retain its fail-closed default: ${KT_ALLOW_DEMO_SEED:-false}
    expect(composeConfig).toMatch(/KT_ALLOW_DEMO_SEED:\s*\$\{KT_ALLOW_DEMO_SEED:-false\}/);

    // Seed safety must reject execution without explicit authorization
    expect(() => assertSeedExecutionAllowed({
      nodeEnv: "development",
      classification: "development",
      allowDemoSeed: "false",
      dbUrl: "postgresql://user:pass@localhost:5432/kt_courier_demo_full?schema=public",
    })).toThrow(SeedSafetyError);
  });
});

