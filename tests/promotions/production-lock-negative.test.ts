import { describe, expect, it } from "vitest";
import {
  evaluatePromotionsReleaseGate,
  assertPromotionsProductionReady,
  isActualProductionInstance,
  PromotionsProductionLockedError,
  PROMOTIONS_PRODUCTION_BLOCK_REASON,
} from "@/lib/promotions/production-lock";

describe("Promotions Production Lock — Comprehensive Negative & Proof Suite", () => {
  const prodDbUrl = "postgresql://kt_user:super_secret_prod_pw@prod-db.ktcouriers.internal:5432/kt_courier_prod?sslmode=require";
  const rdsDbUrl = "postgresql://postgres:livepassword@kt-prod.cluster-xyz.eu-west-1.rds.amazonaws.com:5432/kt_couriers";
  const testDbUrl = "postgresql://kt_phase75_e2e:phase75_e2e_disposable_only@127.0.0.1:5432/kt_phase75_e2e?schema=public";

  it("fails closed in bare NODE_ENV=production", () => {
    const env = { NODE_ENV: "production" };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
    expect(gate.reason).toBe(PROMOTIONS_PRODUCTION_BLOCK_REASON);
    expect(() => assertPromotionsProductionReady("COMMITMENT", undefined, env)).toThrow(PromotionsProductionLockedError);
  });

  it("fails closed in NODE_ENV=production when combined with KT_RUNTIME_ENV=e2e on a production database", () => {
    const env = {
      NODE_ENV: "production",
      KT_RUNTIME_ENV: "e2e",
      DATABASE_URL: prodDbUrl,
      KT_NETWORK_DISABLED: "true",
    };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
    expect(gate.reason).toBe(PROMOTIONS_PRODUCTION_BLOCK_REASON);
    expect(() => assertPromotionsProductionReady("CAMPAIGN_ACTIVATE", undefined, env)).toThrow(PromotionsProductionLockedError);
  });

  it("fails closed in NODE_ENV=production when combined with KT_PROMOTIONS_TEST_APPROVED=true on AWS RDS", () => {
    const env = {
      NODE_ENV: "production",
      KT_PROMOTIONS_TEST_APPROVED: "true",
      DATABASE_URL: rdsDbUrl,
    };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
    expect(gate.reason).toBe(PROMOTIONS_PRODUCTION_BLOCK_REASON);
    expect(() => assertPromotionsProductionReady("BUDGET_MOVEMENT", undefined, env)).toThrow(PromotionsProductionLockedError);
  });

  it("fails closed in NODE_ENV=production when combined with KT_ALLOW_ISOLATED_POSTGRES_TESTS=1 on a production database", () => {
    const env = {
      NODE_ENV: "production",
      KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      DATABASE_URL: prodDbUrl,
    };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
    expect(() => assertPromotionsProductionReady("FUNDING_JOURNAL", undefined, env)).toThrow(PromotionsProductionLockedError);
  });

  it("denies mistaken testApproval argument in an actual production instance", () => {
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: prodDbUrl,
    };
    expect(isActualProductionInstance(env)).toBe(true);
    expect(() => assertPromotionsProductionReady("REVERSAL", { approved: true }, env)).toThrow(PromotionsProductionLockedError);
  });

  it("fails closed if live Paystack credentials exist regardless of test flags", () => {
    const mockLiveSecretKey = ["sk", "live", "mock_dummy_key"].join("_");
    const env = {
      NODE_ENV: "test",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: mockLiveSecretKey,
      DATABASE_URL: testDbUrl,
      KT_NETWORK_DISABLED: "true",
    };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
    expect(() => assertPromotionsProductionReady("EVALUATION", { approved: true }, env)).toThrow(PromotionsProductionLockedError);
  });

  it("fails closed if network egress is not disabled in browser runner", () => {
    const env = {
      NODE_ENV: "production",
      KT_RUNTIME_ENV: "e2e",
      KT_LOCAL_CHECKOUT_VALIDATION: "true",
      DATABASE_URL: testDbUrl,
      KT_NETWORK_DISABLED: "false", // egress open
    };
    expect(isActualProductionInstance(env)).toBe(true);
    const gate = evaluatePromotionsReleaseGate(env);
    expect(gate.approved).toBe(false);
  });

  it("authorizes ONLY the authenticated, source-bound disposable test harness", () => {
    const disposableHarness = {
      NODE_ENV: "production",
      KT_RUNTIME_ENV: "e2e",
      KT_NETWORK_DISABLED: "true",
      KT_LOCAL_CHECKOUT_VALIDATION: "true",
      DATABASE_URL: testDbUrl,
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider",
    };
    expect(isActualProductionInstance(disposableHarness)).toBe(false);
    const gate = evaluatePromotionsReleaseGate(disposableHarness);
    expect(gate.approved).toBe(true);
    expect(gate.reason).toBeNull();
    expect(() => assertPromotionsProductionReady("EVALUATION", undefined, disposableHarness)).not.toThrow();
  });

  it("authorizes unit test runner in NODE_ENV=test with local non-live configuration", () => {
    const unitEnv = {
      NODE_ENV: "test",
      PAYSTACK_MODE: "test",
    };
    expect(isActualProductionInstance(unitEnv)).toBe(false);
    const gate = evaluatePromotionsReleaseGate(unitEnv);
    expect(gate.approved).toBe(true);
  });
});
