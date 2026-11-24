/**
 * KT Couriers — Redacted Environment Schema Verifier
 *
 * Validates runtime environment configuration before deployment or commerce
 * activation without EVER returning, logging, or echoing secret values,
 * API keys, database passwords, or banking details.
 *
 * Rejects:
 * - Missing or placeholder secrets
 * - Non-production databases during production activation
 * - Production databases during test/staging/e2e runs
 * - Mismatched Paystack key prefixes vs PAYSTACK_MODE
 * - Origin mismatches between NEXT_PUBLIC_APP_URL and PAYMENT_APP_ORIGIN
 * - Accidental temporary Paystack sandbox active alongside KT_COMMERCE_ENABLED=true
 * - Conflicting KT_COMMERCE_ENABLED vs legacy CHECKOUT_PUBLIC_ENABLED values
 */

import { classifyRuntimeEnvironment, type KtRuntimeEnvironment } from "@/lib/runtime/deployment-classification";
import { evaluateCommerceActivation } from "@/lib/runtime/commerce-activation";
import { resolveCommerceSwitch, type EnvironmentRecord } from "@/lib/runtime/commerce-switch";
import { isSafeLocalTestDatabaseUrl } from "@/lib/testing/safe-postgres-validator";
import { isPlaceholderValue } from "@/lib/config/production-validation";

export type EnvCheckStatus = "OK" | "MISSING" | "PLACEHOLDER" | "MISMATCH" | "FORBIDDEN" | "WARNING";

export type EnvSchemaCheckResult = Readonly<{
  key: string;
  status: EnvCheckStatus;
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
}>;

export type EnvSchemaVerificationReport = Readonly<{
  valid: boolean;
  runtime: KtRuntimeEnvironment;
  runtimeValid: boolean;
  commerceRequested: boolean;
  commerceExposed: boolean;
  errorCount: number;
  warningCount: number;
  checks: readonly EnvSchemaCheckResult[];
}>;

function checkEntry(
  key: string,
  status: EnvCheckStatus,
  severity: "ERROR" | "WARNING" | "INFO",
  code: string,
  message: string,
): EnvSchemaCheckResult {
  return Object.freeze({ key, status, severity, code, message });
}

function parseSafeOrigin(raw: string | undefined): { valid: boolean; protocol?: string; origin?: string; isLocal?: boolean } {
  if (!raw || isPlaceholderValue(raw)) return { valid: false };
  try {
    const parsed = new URL(raw.trim());
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return { valid: false };
    if (parsed.pathname !== "/" && parsed.pathname !== "") return { valid: false };
    const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsed.hostname.toLowerCase());
    return { valid: true, protocol: parsed.protocol, origin: parsed.origin, isLocal };
  } catch {
    return { valid: false };
  }
}

function classifyPaystackKeyPrefix(raw: string | undefined, kind: "secret" | "public"): "missing" | "placeholder" | "live" | "test" | "invalid" {
  if (!raw || raw.trim().length === 0) return "missing";
  if (isPlaceholderValue(raw)) return "placeholder";
  const trimmed = raw.trim();
  const livePrefix = kind === "secret" ? "sk_live_" : "pk_live_";
  const testPrefix = kind === "secret" ? "sk_test_" : "pk_test_";
  if (trimmed.startsWith(livePrefix)) return "live";
  if (trimmed.startsWith(testPrefix)) return "test";
  return "invalid";
}

function checkSecretKeyPresence(
  checks: EnvSchemaCheckResult[],
  source: EnvironmentRecord,
  key: string,
  requiredInProduction: boolean,
  isProduction: boolean,
): void {
  const raw = source[key];
  if (!raw || raw.trim().length === 0) {
    if (requiredInProduction && isProduction) {
      checks.push(checkEntry(key, "MISSING", "ERROR", `${key}_MISSING`, `${key} is required in production.`));
    } else {
      checks.push(checkEntry(key, "MISSING", "INFO", `${key}_UNSET`, `${key} is not set.`));
    }
    return;
  }
  if (isPlaceholderValue(raw)) {
    checks.push(checkEntry(
      key,
      "PLACEHOLDER",
      isProduction ? "ERROR" : "WARNING",
      `${key}_PLACEHOLDER`,
      `${key} contains a template placeholder value and must be replaced.`,
    ));
    return;
  }
  checks.push(checkEntry(key, "OK", "INFO", `${key}_CONFIGURED`, `${key} is configured.`));
}

/**
 * Verifies environment variable schema and cross-variable invariants.
 * Never returns or interpolates raw environment values into any message.
 */
export function verifyEnvironmentSchema(
  source: EnvironmentRecord = process.env,
): EnvSchemaVerificationReport {
  const checks: EnvSchemaCheckResult[] = [];
  const classification = classifyRuntimeEnvironment(source);
  const switchState = resolveCommerceSwitch(source);
  const activation = evaluateCommerceActivation(source);

  const isProduction = classification.runtime === "production";
  const isProductionCommerceRequested = isProduction && switchState.globalRequested;

  // 1. Runtime classification coherence
  if (!classification.isValid) {
    checks.push(checkEntry(
      "KT_RUNTIME_ENV",
      "FORBIDDEN",
      "ERROR",
      classification.conflictReason ?? "RUNTIME_CLASSIFICATION_INVALID",
      "Runtime classification flags conflict with database or NODE_ENV safety rules.",
    ));
  } else {
    checks.push(checkEntry(
      "KT_RUNTIME_ENV",
      "OK",
      "INFO",
      "RUNTIME_CLASSIFIED",
      `Runtime classified cleanly as ${classification.runtime}.`,
    ));
  }

  // 2. Single authoritative commerce switch & legacy migration checks
  if (switchState.hasConflictingLegacySwitch) {
    checks.push(checkEntry(
      "KT_COMMERCE_ENABLED",
      "MISMATCH",
      "ERROR",
      "CONFLICTING_COMMERCE_SWITCH_DEFINITIONS",
      "KT_COMMERCE_ENABLED conflicts with deprecated CHECKOUT_PUBLIC_ENABLED; remove the duplicate legacy variable.",
    ));
  } else if (switchState.source === "LEGACY_CHECKOUT_PUBLIC_ENABLED") {
    checks.push(checkEntry(
      "CHECKOUT_PUBLIC_ENABLED",
      "WARNING",
      "WARNING",
      "LEGACY_SWITCH_FALLBACK_ACTIVE",
      "Using deprecated CHECKOUT_PUBLIC_ENABLED fallback; migrate to KT_COMMERCE_ENABLED.",
    ));
  } else {
    checks.push(checkEntry(
      "KT_COMMERCE_ENABLED",
      "OK",
      "INFO",
      switchState.globalRequested ? "COMMERCE_SWITCH_ENABLED" : "COMMERCE_SWITCH_DISABLED",
      switchState.globalRequested
        ? "Authoritative KT_COMMERCE_ENABLED switch requests public commerce exposure."
        : "Authoritative KT_COMMERCE_ENABLED switch keeps new public commerce closed.",
    ));
  }

  // 3. Database URL & classification alignment
  const dbRaw = source.DATABASE_URL;
  if (!dbRaw || dbRaw.trim().length === 0) {
    checks.push(checkEntry("DATABASE_URL", "MISSING", isProduction ? "ERROR" : "WARNING", "DATABASE_URL_MISSING", "DATABASE_URL is not configured."));
  } else if (isPlaceholderValue(dbRaw)) {
    checks.push(checkEntry("DATABASE_URL", "PLACEHOLDER", "ERROR", "DATABASE_URL_PLACEHOLDER", "DATABASE_URL contains a placeholder value."));
  } else {
    const isLocalTestDb = isSafeLocalTestDatabaseUrl(dbRaw);
    const dbClass = source.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase();
    if (isProduction && (isLocalTestDb || (isProductionCommerceRequested && dbClass !== "production"))) {
      checks.push(checkEntry(
        "DATABASE_URL",
        "FORBIDDEN",
        "ERROR",
        isLocalTestDb ? "NON_PRODUCTION_DB_IN_PRODUCTION" : "PRODUCTION_DB_CLASSIFICATION_REQUIRED",
        isLocalTestDb
          ? "Production activation cannot run against a local or disposable test database."
          : "KT_DATABASE_CLASSIFICATION must be set to production when activating production commerce.",
      ));
    } else {
      checks.push(checkEntry("DATABASE_URL", "OK", "INFO", "DATABASE_URL_VALID", "DATABASE_URL matches runtime safety boundaries."));
    }
  }

  // 4. Paystack mode, key prefix parity, and accidental temporary sandbox detection
  const rawPaystackMode = source.PAYSTACK_MODE?.trim().toLowerCase() || "disabled";
  const secretClass = classifyPaystackKeyPrefix(source.PAYSTACK_SECRET_KEY, "secret");
  const publicClass = classifyPaystackKeyPrefix(source.PAYSTACK_PUBLIC_KEY, "public");
  const tempSandbox = source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true";

  if (!["disabled", "test", "live"].includes(rawPaystackMode)) {
    checks.push(checkEntry("PAYSTACK_MODE", "MISMATCH", "ERROR", "PAYSTACK_MODE_INVALID", "PAYSTACK_MODE must be disabled, test, or live."));
  } else if (rawPaystackMode === "live") {
    if (!isProduction) {
      checks.push(checkEntry("PAYSTACK_MODE", "FORBIDDEN", "ERROR", "PAYSTACK_LIVE_FORBIDDEN_NON_PRODUCTION", "PAYSTACK_MODE=live is forbidden outside production."));
    } else {
      checks.push(checkEntry("PAYSTACK_MODE", "OK", "INFO", "PAYSTACK_MODE_LIVE", "PAYSTACK_MODE is set to live."));
    }
    if (secretClass !== "live") {
      checks.push(checkEntry(
        "PAYSTACK_SECRET_KEY",
        secretClass === "missing" ? "MISSING" : secretClass === "placeholder" ? "PLACEHOLDER" : "MISMATCH",
        "ERROR",
        "PAYSTACK_SECRET_KEY_PREFIX_MISMATCH",
        "PAYSTACK_MODE=live requires a non-placeholder live secret key prefix.",
      ));
    } else {
      checks.push(checkEntry("PAYSTACK_SECRET_KEY", "OK", "INFO", "PAYSTACK_SECRET_KEY_LIVE_PREFIX", "PAYSTACK_SECRET_KEY matches live mode."));
    }
    if (publicClass !== "live") {
      checks.push(checkEntry(
        "PAYSTACK_PUBLIC_KEY",
        publicClass === "missing" ? "MISSING" : publicClass === "placeholder" ? "PLACEHOLDER" : "MISMATCH",
        "ERROR",
        "PAYSTACK_PUBLIC_KEY_PREFIX_MISMATCH",
        "PAYSTACK_MODE=live requires a non-placeholder live public key prefix.",
      ));
    } else {
      checks.push(checkEntry("PAYSTACK_PUBLIC_KEY", "OK", "INFO", "PAYSTACK_PUBLIC_KEY_LIVE_PREFIX", "PAYSTACK_PUBLIC_KEY matches live mode."));
    }
  } else if (rawPaystackMode === "test") {
    if (isProduction && !tempSandbox) {
      checks.push(checkEntry("PAYSTACK_MODE", "FORBIDDEN", "ERROR", "PAYSTACK_TEST_MODE_IN_PRODUCTION", "PAYSTACK_MODE=test is forbidden in production without an explicit bounded temporary sandbox."));
    } else {
      checks.push(checkEntry("PAYSTACK_MODE", "OK", "INFO", "PAYSTACK_MODE_TEST", "PAYSTACK_MODE is set to test."));
    }
    if (secretClass !== "test") {
      checks.push(checkEntry(
        "PAYSTACK_SECRET_KEY",
        secretClass === "missing" ? "MISSING" : secretClass === "placeholder" ? "PLACEHOLDER" : "MISMATCH",
        "ERROR",
        "PAYSTACK_SECRET_KEY_PREFIX_MISMATCH",
        "PAYSTACK_MODE=test requires a non-placeholder test secret key prefix.",
      ));
    } else {
      checks.push(checkEntry("PAYSTACK_SECRET_KEY", "OK", "INFO", "PAYSTACK_SECRET_KEY_TEST_PREFIX", "PAYSTACK_SECRET_KEY matches test mode."));
    }
    if (publicClass !== "missing" && publicClass !== "test") {
      checks.push(checkEntry(
        "PAYSTACK_PUBLIC_KEY",
        publicClass === "placeholder" ? "PLACEHOLDER" : "MISMATCH",
        "ERROR",
        "PAYSTACK_PUBLIC_KEY_PREFIX_MISMATCH",
        "PAYSTACK_MODE=test requires a non-placeholder test public key prefix.",
      ));
    }
  } else {
    if (isProductionCommerceRequested && !tempSandbox) {
      checks.push(checkEntry("PAYSTACK_MODE", "MISSING", "ERROR", "PAYSTACK_DISABLED_WHILE_COMMERCE_REQUESTED", "PAYSTACK_MODE cannot be disabled when KT_COMMERCE_ENABLED=true in production."));
    } else {
      checks.push(checkEntry("PAYSTACK_MODE", "OK", "INFO", "PAYSTACK_MODE_DISABLED", "PAYSTACK_MODE is disabled."));
    }
  }

  // Detect accidental or expired temporary sandbox override
  if (tempSandbox) {
    if (!isProduction) {
      checks.push(checkEntry(
        "PAYSTACK_TEMPORARY_SANDBOX_ENABLED",
        "FORBIDDEN",
        "ERROR",
        "TEMPORARY_SANDBOX_NON_PRODUCTION",
        "PAYSTACK_TEMPORARY_SANDBOX_ENABLED is only allowed in a production runtime.",
      ));
    } else if (isProductionCommerceRequested) {
      checks.push(checkEntry(
        "PAYSTACK_TEMPORARY_SANDBOX_ENABLED",
        "FORBIDDEN",
        "ERROR",
        "ACCIDENTAL_TEMPORARY_SANDBOX_WITH_COMMERCE_ENABLED",
        "Disable PAYSTACK_TEMPORARY_SANDBOX_ENABLED before activating live KT_COMMERCE_ENABLED=true.",
      ));
    } else if (!activation.temporarySandboxActive) {
      checks.push(checkEntry(
        "PAYSTACK_TEMPORARY_SANDBOX_UNTIL",
        "FORBIDDEN",
        "ERROR",
        "PAYSTACK_SANDBOX_EXPIRED_OR_INVALID",
        "Temporary Paystack sandbox is expired or missing valid test keys/ISO expiry.",
      ));
    } else {
      checks.push(checkEntry(
        "PAYSTACK_TEMPORARY_SANDBOX_ENABLED",
        "WARNING",
        "WARNING",
        "TEMPORARY_SANDBOX_ACTIVE",
        "Temporary bounded Paystack sandbox override is currently active.",
      ));
    }
  }

  // 5. Origin coherence (NEXT_PUBLIC_APP_URL vs PAYMENT_APP_ORIGIN)
  const appOrigin = parseSafeOrigin(source.NEXT_PUBLIC_APP_URL);
  const paymentOrigin = parseSafeOrigin(source.PAYMENT_APP_ORIGIN);
  if (isProduction) {
    if (!appOrigin.valid || appOrigin.protocol !== "https:" || appOrigin.isLocal) {
      checks.push(checkEntry("NEXT_PUBLIC_APP_URL", "MISMATCH", "ERROR", "APP_ORIGIN_INVALID_IN_PRODUCTION", "NEXT_PUBLIC_APP_URL must be a valid non-local HTTPS origin in production."));
    } else {
      checks.push(checkEntry("NEXT_PUBLIC_APP_URL", "OK", "INFO", "APP_ORIGIN_VALID", "NEXT_PUBLIC_APP_URL is a valid HTTPS origin."));
    }
    if (!paymentOrigin.valid || paymentOrigin.protocol !== "https:" || paymentOrigin.isLocal) {
      checks.push(checkEntry("PAYMENT_APP_ORIGIN", "MISMATCH", "ERROR", "PAYMENT_ORIGIN_INVALID_IN_PRODUCTION", "PAYMENT_APP_ORIGIN must be a valid non-local HTTPS origin in production."));
    } else if (appOrigin.valid && appOrigin.origin !== paymentOrigin.origin) {
      checks.push(checkEntry("PAYMENT_APP_ORIGIN", "MISMATCH", "ERROR", "PAYMENT_APP_ORIGIN_MISMATCH", "PAYMENT_APP_ORIGIN does not match NEXT_PUBLIC_APP_URL."));
    } else {
      checks.push(checkEntry("PAYMENT_APP_ORIGIN", "OK", "INFO", "PAYMENT_ORIGIN_COHERENT", "PAYMENT_APP_ORIGIN matches NEXT_PUBLIC_APP_URL."));
    }
  } else if (appOrigin.valid && paymentOrigin.valid && appOrigin.origin !== paymentOrigin.origin) {
    checks.push(checkEntry("PAYMENT_APP_ORIGIN", "MISMATCH", "WARNING", "PAYMENT_APP_ORIGIN_MISMATCH", "PAYMENT_APP_ORIGIN differs from NEXT_PUBLIC_APP_URL."));
  }

  // 6. Core production secrets & infrastructure keys (names + status ONLY, never values)
  checkSecretKeyPresence(checks, source, "REDIS_URL", true, isProduction);
  checkSecretKeyPresence(checks, source, "AUTH_OTP_HMAC_KEY", true, isProduction);
  checkSecretKeyPresence(checks, source, "NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", true, isProduction);
  checkSecretKeyPresence(checks, source, "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", true, isProduction);
  checkSecretKeyPresence(checks, source, "CRON_SECRET", true, isProduction);
  checkSecretKeyPresence(checks, source, "INTERNAL_JOB_SECRET", true, isProduction);
  checkSecretKeyPresence(checks, source, "GOOGLE_MAPS_SERVER_KEY", isProductionCommerceRequested, isProduction);
  checkSecretKeyPresence(checks, source, "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", isProductionCommerceRequested, isProduction);
  checkSecretKeyPresence(checks, source, "RESEND_API_KEY", source.EMAIL_PROVIDER === "resend", isProduction);

  // 7. Forbidden test/demo flags in production
  if (isProduction) {
    for (const forbiddenKey of ["KT_ALLOW_DEMO_SEED", "KT_LOCAL_FULL_FLOW", "KT_LOCAL_CHECKOUT_VALIDATION"] as const) {
      if (source[forbiddenKey] === "true" || source[forbiddenKey] === "1") {
        checks.push(checkEntry(
          forbiddenKey,
          "FORBIDDEN",
          "ERROR",
          `${forbiddenKey}_FORBIDDEN_IN_PRODUCTION`,
          `${forbiddenKey} must never be enabled in production.`,
        ));
      }
    }
    if (source.CORS_ALLOW_ORIGIN === "*") {
      checks.push(checkEntry("CORS_ALLOW_ORIGIN", "FORBIDDEN", "ERROR", "CORS_WILDCARD_FORBIDDEN", "CORS_ALLOW_ORIGIN cannot be '*' in production."));
    }
  }

  // 8. Governed module storage/secrets & server-verified parity authorities (names + status ONLY)
  const reportStorage = source.REPORT_ARTIFACT_STORAGE?.trim().toLowerCase() ?? "";
  if (reportStorage) {
    if (!["local", "s3", "cloudinary"].includes(reportStorage)) {
      checks.push(checkEntry("REPORT_ARTIFACT_STORAGE", "MISMATCH", "ERROR", "REPORT_ARTIFACT_STORAGE_INVALID", "REPORT_ARTIFACT_STORAGE must be local, s3, or cloudinary."));
    } else if (isProduction && reportStorage === "local") {
      checks.push(checkEntry("REPORT_ARTIFACT_STORAGE", "FORBIDDEN", "ERROR", "REPORT_ARTIFACT_LOCAL_FORBIDDEN_IN_PRODUCTION", "REPORT_ARTIFACT_STORAGE=local is forbidden in production."));
    } else if (reportStorage === "s3") {
      const s3Endpoint = parseSafeOrigin(source.REPORT_ARTIFACT_S3_ENDPOINT);
      if (!s3Endpoint.valid || (isProduction && (s3Endpoint.protocol !== "https:" || s3Endpoint.isLocal))) {
        checks.push(checkEntry("REPORT_ARTIFACT_S3_ENDPOINT", "MISMATCH", "ERROR", "REPORT_ARTIFACT_S3_ENDPOINT_INVALID", "REPORT_ARTIFACT_S3_ENDPOINT must be a valid HTTPS origin when REPORT_ARTIFACT_STORAGE=s3."));
      }
      checkSecretKeyPresence(checks, source, "REPORT_ARTIFACT_S3_BUCKET", true, isProduction);
      checkSecretKeyPresence(checks, source, "REPORT_ARTIFACT_S3_ACCESS_KEY_ID", true, isProduction);
      checkSecretKeyPresence(checks, source, "REPORT_ARTIFACT_S3_SECRET_ACCESS_KEY", true, isProduction);
    } else if (reportStorage === "cloudinary") {
      checkSecretKeyPresence(checks, source, "CLOUDINARY_CLOUD_NAME", true, isProduction);
      checkSecretKeyPresence(checks, source, "CLOUDINARY_API_KEY", true, isProduction);
      checkSecretKeyPresence(checks, source, "CLOUDINARY_API_SECRET", true, isProduction);
    }
  }

  const devEnv = source.DEVELOPER_API_ENDPOINT_ENVIRONMENT?.trim().toUpperCase() ?? "";
  if (devEnv && !["TEST", "PRODUCTION"].includes(devEnv)) {
    checks.push(checkEntry("DEVELOPER_API_ENDPOINT_ENVIRONMENT", "MISMATCH", "ERROR", "DEVELOPER_API_ENVIRONMENT_INVALID", "DEVELOPER_API_ENDPOINT_ENVIRONMENT must be TEST or PRODUCTION."));
  }
  const devRequired = devEnv === "PRODUCTION";
  checkSecretKeyPresence(checks, source, "DEVELOPER_API_CREDENTIAL_HMAC_KEY", devRequired, isProduction);
  checkSecretKeyPresence(checks, source, "DEVELOPER_API_CURSOR_HMAC_KEY", devRequired, isProduction);
  checkSecretKeyPresence(checks, source, "DEVELOPER_WEBHOOK_ENCRYPTION_KEY", devRequired, isProduction);

  const parityUrlRaw = source.KT_PARITY_VERIFIER_URL?.trim();
  if (parityUrlRaw) {
    if (isPlaceholderValue(parityUrlRaw)) {
      checks.push(checkEntry("KT_PARITY_VERIFIER_URL", "PLACEHOLDER", isProduction ? "ERROR" : "WARNING", "KT_PARITY_VERIFIER_URL_PLACEHOLDER", "KT_PARITY_VERIFIER_URL contains a placeholder value."));
    } else {
      try {
        const parsedParity = new URL(parityUrlRaw);
        const isLocalParity = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsedParity.hostname.toLowerCase());
        if (isProduction && (parsedParity.protocol !== "https:" || isLocalParity)) {
          checks.push(checkEntry("KT_PARITY_VERIFIER_URL", "FORBIDDEN", "ERROR", "KT_PARITY_VERIFIER_URL_UNSAFE", "KT_PARITY_VERIFIER_URL must use non-local HTTPS in production."));
        } else {
          checks.push(checkEntry("KT_PARITY_VERIFIER_URL", "OK", "INFO", "KT_PARITY_VERIFIER_URL_VALID", "KT_PARITY_VERIFIER_URL format verified."));
        }
      } catch {
        checks.push(checkEntry("KT_PARITY_VERIFIER_URL", "MISMATCH", "ERROR", "KT_PARITY_VERIFIER_URL_INVALID", "KT_PARITY_VERIFIER_URL is not a valid URL."));
      }
    }
  } else {
    checks.push(checkEntry(
      "KT_PARITY_VERIFIER_URL",
      "MISSING",
      "INFO",
      "KT_PARITY_VERIFIER_URL_UNSET",
      "KT_PARITY_VERIFIER_URL is unset; production deployment parity verification fails closed until configured.",
    ));
  }

  const auditRoRaw = source.KT_AUDIT_READONLY_DATABASE_URL?.trim();
  if (auditRoRaw) {
    if (isPlaceholderValue(auditRoRaw)) {
      checks.push(checkEntry(
        "KT_AUDIT_READONLY_DATABASE_URL",
        "PLACEHOLDER",
        isProduction ? "ERROR" : "WARNING",
        "KT_AUDIT_READONLY_DATABASE_URL_PLACEHOLDER",
        "KT_AUDIT_READONLY_DATABASE_URL contains a placeholder value.",
      ));
    } else if (source.DATABASE_URL?.trim() && auditRoRaw === source.DATABASE_URL.trim()) {
      checks.push(checkEntry(
        "KT_AUDIT_READONLY_DATABASE_URL",
        "FORBIDDEN",
        "ERROR",
        "KT_AUDIT_READONLY_DATABASE_URL_MATCHES_WRITABLE_DB",
        "KT_AUDIT_READONLY_DATABASE_URL must be a distinct least-privilege read-only credential, never writable DATABASE_URL.",
      ));
    } else if (isProduction && isSafeLocalTestDatabaseUrl(auditRoRaw)) {
      checks.push(checkEntry(
        "KT_AUDIT_READONLY_DATABASE_URL",
        "FORBIDDEN",
        "ERROR",
        "NON_PRODUCTION_AUDIT_DB_IN_PRODUCTION",
        "KT_AUDIT_READONLY_DATABASE_URL cannot target a local or disposable test database in production.",
      ));
    } else {
      checks.push(checkEntry(
        "KT_AUDIT_READONLY_DATABASE_URL",
        "OK",
        "INFO",
        "KT_AUDIT_READONLY_DATABASE_URL_CONFIGURED",
        "KT_AUDIT_READONLY_DATABASE_URL is separated from writable DATABASE_URL.",
      ));
    }
  }

  const expectedAuditDb = source.KT_EXPECTED_AUDIT_DATABASE?.trim();
  if (expectedAuditDb && isPlaceholderValue(expectedAuditDb)) {
    checks.push(checkEntry(
      "KT_EXPECTED_AUDIT_DATABASE",
      "PLACEHOLDER",
      isProduction ? "ERROR" : "WARNING",
      "KT_EXPECTED_AUDIT_DATABASE_PLACEHOLDER",
      "KT_EXPECTED_AUDIT_DATABASE contains a placeholder value.",
    ));
  }

  const expectedAuditClass = source.KT_EXPECTED_AUDIT_CLASSIFICATION?.trim();
  if (expectedAuditClass) {
    if (!["production", "isolated_test"].includes(expectedAuditClass)) {
      checks.push(checkEntry(
        "KT_EXPECTED_AUDIT_CLASSIFICATION",
        "MISMATCH",
        "ERROR",
        "KT_EXPECTED_AUDIT_CLASSIFICATION_INVALID",
        "KT_EXPECTED_AUDIT_CLASSIFICATION must be 'production' or 'isolated_test'.",
      ));
    } else if (isProduction && expectedAuditClass !== "production") {
      checks.push(checkEntry(
        "KT_EXPECTED_AUDIT_CLASSIFICATION",
        "FORBIDDEN",
        "ERROR",
        "KT_EXPECTED_AUDIT_CLASSIFICATION_FORBIDDEN",
        "KT_EXPECTED_AUDIT_CLASSIFICATION must be 'production' in production runtimes.",
      ));
    }
  }

  checkSecretKeyPresence(checks, source, "GITHUB_RELEASE_READ_TOKEN", false, isProduction);
  checkSecretKeyPresence(checks, source, "VERCEL_TOKEN", false, isProduction);
  checkSecretKeyPresence(checks, source, "RAILWAY_API_TOKEN", false, isProduction);

  const errorCount = checks.filter((item) => item.severity === "ERROR").length;
  const warningCount = checks.filter((item) => item.severity === "WARNING").length;

  return Object.freeze({
    valid: errorCount === 0,
    runtime: classification.runtime,
    runtimeValid: classification.isValid,
    commerceRequested: switchState.globalRequested,
    commerceExposed: activation.publicCheckoutExposed,
    errorCount,
    warningCount,
    checks: Object.freeze(checks),
  });
}
