import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  evaluateCommerceActivation,
  resolveCommerceSwitch,
} from "@/lib/runtime/commerce-activation";
import { verifyEnvironmentSchema } from "@/lib/runtime/env-schema-verifier";
import {
  resolvePaystackConfiguration,
  resolvePaystackStoredEventSecretKey,
  resolvePaystackWebhookSecretKey,
} from "@/lib/payments/providers/paystack/paystack-config";
import { evaluateRefundProductionReadiness } from "@/lib/refunds/refund-production-readiness";

const ROOT = process.cwd();

function listSourceFiles(dir: string): string[] {
  const full = path.join(ROOT, dir);
  const results: string[] = [];
  for (const entry of readdirSync(full)) {
    const child = path.join(full, entry);
    const st = statSync(child);
    if (st.isDirectory()) {
      results.push(...listSourceFiles(path.join(dir, entry)));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      results.push(path.join(dir, entry).replaceAll("\\", "/"));
    }
  }
  return results;
}

describe("Authoritative KT_COMMERCE_ENABLED switch & CommerceActivation (C01 / C02)", () => {
  it("prioritizes KT_COMMERCE_ENABLED, fails closed by default, and flags conflicting legacy CHECKOUT_PUBLIC_ENABLED", () => {
    expect(resolveCommerceSwitch({})).toMatchObject({
      globalRequested: false,
      source: "UNSET",
      hasConflictingLegacySwitch: false,
    });

    expect(resolveCommerceSwitch({ KT_COMMERCE_ENABLED: "true" })).toMatchObject({
      globalRequested: true,
      source: "KT_COMMERCE_ENABLED",
      hasConflictingLegacySwitch: false,
    });

    expect(resolveCommerceSwitch({ KT_COMMERCE_ENABLED: "false", CHECKOUT_PUBLIC_ENABLED: "true" })).toMatchObject({
      globalRequested: false,
      source: "KT_COMMERCE_ENABLED",
      hasConflictingLegacySwitch: true,
      warnings: ["CONFLICTING_COMMERCE_SWITCH_DEFINITIONS"],
    });

    expect(resolveCommerceSwitch({ CHECKOUT_PUBLIC_ENABLED: "true" })).toMatchObject({
      globalRequested: true,
      source: "LEGACY_CHECKOUT_PUBLIC_ENABLED",
      hasConflictingLegacySwitch: false,
      warnings: ["LEGACY_SWITCH_FALLBACK_ACTIVE"],
    });

    expect(resolveCommerceSwitch({ KT_COMMERCE_ENABLED: "bogus", CHECKOUT_PUBLIC_ENABLED: "true" })).toMatchObject({
      globalRequested: false,
      source: "KT_COMMERCE_ENABLED",
    });
  });

  it("exposes public parcel and store checkout consistently under KT_COMMERCE_ENABLED=true + live Paystack config", () => {
    const prodEnabled = {
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      KT_COMMERCE_ENABLED: "true",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: "sk_live_unit_test_secret_fixture",
      PAYSTACK_PUBLIC_KEY: "pk_live_unit_test_public_fixture",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
    };

    const active = evaluateCommerceActivation(prodEnabled, {
      parcelPolicyEligible: true,
      storePolicyEligible: true,
      codPolicyEligible: true,
    });
    expect(active).toMatchObject({
      globalRequested: true,
      switchSource: "KT_COMMERCE_ENABLED",
      runtime: "production",
      runtimeValid: true,
      publicCheckoutExposed: true,
      parcelCardAllowed: true,
      storeCardAllowed: true,
      codOffered: true,
      paystackMode: "live",
      paystackEnvironment: "production",
      primaryBlockReason: null,
    });

    // Global switch OFF closes all public checkout creation consistently...
    const prodDisabled = { ...prodEnabled, KT_COMMERCE_ENABLED: "false" };
    const closed = evaluateCommerceActivation(prodDisabled, {
      parcelPolicyEligible: true,
      storePolicyEligible: true,
      codPolicyEligible: true,
    });
    expect(closed).toMatchObject({
      globalRequested: false,
      publicCheckoutExposed: false,
      parcelCardAllowed: false,
      storeCardAllowed: false,
      codOffered: false,
    });

    // ...WITHOUT suppressing verified webhook / Verify recovery / external refunds!
    const paystack = resolvePaystackConfiguration(prodDisabled);
    expect(paystack.runtime).not.toBeNull();
    expect(resolvePaystackWebhookSecretKey(prodDisabled)).toBe("sk_live_unit_test_secret_fixture");
    expect(resolvePaystackStoredEventSecretKey("PRODUCTION", true, prodDisabled)).toBe(
      "sk_live_unit_test_secret_fixture",
    );
    expect(evaluateRefundProductionReadiness(prodDisabled, "EXTERNAL_PROVIDER")).toMatchObject({
      externalRefundsActive: true,
      productionValidationApproved: true,
    });
  });

  it("never infers live mode from test mode in production even when KT_COMMERCE_ENABLED=true", () => {
    const bogusLiveAttempt = {
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      KT_COMMERCE_ENABLED: "true",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_fake_live_attempt",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
    };
    const activation = evaluateCommerceActivation(bogusLiveAttempt);
    expect(activation.publicCheckoutExposed).toBe(false);
    expect(activation.parcelCardAllowed).toBe(false);
    expect(activation.storeCardAllowed).toBe(false);
  });

  it("prevents reintroduction of scattered CHECKOUT_PUBLIC_ENABLED reads in app/lib/components", () => {
    const files = ["lib", "app", "components"].flatMap(listSourceFiles);
    const readers = files.filter((rel) => {
      if (rel === "lib/runtime/commerce-switch.ts") return false;
      const content = readFileSync(path.join(ROOT, rel), "utf8");
      return /\b(?:process\.)?(?:env|source)\s*\.\s*CHECKOUT_PUBLIC_ENABLED\b|\[\s*["']CHECKOUT_PUBLIC_ENABLED["']\s*\]/.test(
        content,
      );
    });
    expect(readers).toEqual([]);
  });
});

describe("Redacted Environment Schema Verifier (§B.4)", () => {
  const secretSentinel = "sk_live_SUPER_SECRET_TOKEN_DO_NOT_LEAK_998877";
  const dbPassSentinel = "VerySecretPostgresPassword12345";

  it("passes cleanly for valid coherent production config and NEVER leaks secret values", () => {
    const validProd = {
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      KT_COMMERCE_ENABLED: "true",
      DATABASE_URL: `postgresql://postgres:${dbPassSentinel}@db.internal:5432/kt_prod?sslmode=require`,
      REDIS_URL: "rediss://default:SecretRedisPass@redis.internal:6379",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: secretSentinel,
      PAYSTACK_PUBLIC_KEY: "pk_live_public_safe_test",
      NEXT_PUBLIC_APP_URL: "https://www.ktcouriers.com",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
      AUTH_OTP_HMAC_KEY: "a".repeat(64),
      NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: "b".repeat(64),
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "c".repeat(64),
      CRON_SECRET: "d".repeat(48),
      INTERNAL_JOB_SECRET: "e".repeat(48),
      GOOGLE_MAPS_SERVER_KEY: "AIzaValidServerFixtureKey",
      NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "AIzaValidBrowserFixtureKey",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_valid_fixture_key",
    };

    const report = verifyEnvironmentSchema(validProd);
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.commerceRequested).toBe(true);
    expect(report.commerceExposed).toBe(true);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secretSentinel);
    expect(serialized).not.toContain(dbPassSentinel);
    expect(serialized).not.toContain("SecretRedisPass");
  });

  it("rejects mismatched prefixes, origin drift, non-prod DB in prod, and accidental sandbox alongside KT_COMMERCE_ENABLED=true", () => {
    const broken = {
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      KT_COMMERCE_ENABLED: "true",
      CHECKOUT_PUBLIC_ENABLED: "false",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/kt_test",
      PAYSTACK_MODE: "live",
      PAYSTACK_SECRET_KEY: "sk_test_wrong_prefix_for_live",
      PAYSTACK_PUBLIC_KEY: "replace-me",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
      NEXT_PUBLIC_APP_URL: "https://www.ktcouriers.com",
      PAYMENT_APP_ORIGIN: "https://staging.ktcouriers.com",
      KT_LOCAL_FULL_FLOW: "true",
    };

    const report = verifyEnvironmentSchema(broken);
    expect(report.valid).toBe(false);
    const codes = report.checks.map((c) => c.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "CONFLICTING_COMMERCE_SWITCH_DEFINITIONS",
        "NON_PRODUCTION_DB_IN_PRODUCTION",
        "PAYSTACK_SECRET_KEY_PREFIX_MISMATCH",
        "PAYSTACK_PUBLIC_KEY_PREFIX_MISMATCH",
        "ACCIDENTAL_TEMPORARY_SANDBOX_WITH_COMMERCE_ENABLED",
        "PAYMENT_APP_ORIGIN_MISMATCH",
        "KT_LOCAL_FULL_FLOW_FORBIDDEN_IN_PRODUCTION",
      ]),
    );
  });

  it("enforces reporting durable storage, developer API production keys, and parity verifier URL rules", () => {
    const baseProd = {
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      KT_COMMERCE_ENABLED: "false",
      DATABASE_URL: "postgresql://postgres:SecretPass@db.internal:5432/kt_prod?sslmode=require",
      REDIS_URL: "rediss://default:SecretRedis@redis.internal:6379",
      PAYSTACK_MODE: "disabled",
      NEXT_PUBLIC_APP_URL: "https://www.ktcouriers.com",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
      AUTH_OTP_HMAC_KEY: "a".repeat(64),
      NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: "b".repeat(64),
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: "c".repeat(64),
      CRON_SECRET: "d".repeat(48),
      INTERNAL_JOB_SECRET: "e".repeat(48),
    };

    const badReport = verifyEnvironmentSchema({
      ...baseProd,
      REPORT_ARTIFACT_STORAGE: "local",
      DEVELOPER_API_ENDPOINT_ENVIRONMENT: "PRODUCTION",
      KT_PARITY_VERIFIER_URL: "http://127.0.0.1:8080/parity",
    });
    expect(badReport.valid).toBe(false);
    expect(badReport.checks.map((c) => c.code)).toEqual(
      expect.arrayContaining([
        "REPORT_ARTIFACT_LOCAL_FORBIDDEN_IN_PRODUCTION",
        "DEVELOPER_API_CREDENTIAL_HMAC_KEY_MISSING",
        "DEVELOPER_API_CURSOR_HMAC_KEY_MISSING",
        "DEVELOPER_WEBHOOK_ENCRYPTION_KEY_MISSING",
        "KT_PARITY_VERIFIER_URL_UNSAFE",
      ]),
    );

    const s3Secret = "SecretS3ReportingKey987654";
    const goodS3Report = verifyEnvironmentSchema({
      ...baseProd,
      REPORT_ARTIFACT_STORAGE: "s3",
      REPORT_ARTIFACT_S3_ENDPOINT: "https://s3.af-south-1.example.com",
      REPORT_ARTIFACT_S3_BUCKET: "kt-prod-reports",
      REPORT_ARTIFACT_S3_ACCESS_KEY_ID: "AKIA_TEST_ID_1234",
      REPORT_ARTIFACT_S3_SECRET_ACCESS_KEY: s3Secret,
      DEVELOPER_API_ENDPOINT_ENVIRONMENT: "PRODUCTION",
      DEVELOPER_API_CREDENTIAL_HMAC_KEY: "f".repeat(64),
      DEVELOPER_API_CURSOR_HMAC_KEY: "g".repeat(64),
      DEVELOPER_WEBHOOK_ENCRYPTION_KEY: "h".repeat(64),
      KT_PARITY_VERIFIER_URL: "https://authority.ktcouriers.com/v1/release-authority/parity/verify",
    });
    expect(goodS3Report.valid).toBe(true);
    expect(JSON.stringify(goodS3Report)).not.toContain(s3Secret);
  });
});
