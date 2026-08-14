import { resolvePayfastConfiguration } from "@/lib/payments/providers/payfast/payfast-config";

export type ConfigurationBlock = "STARTUP" | "READINESS" | "NONE";

export interface SafeConfigurationIssue {
  capability: string;
  reasonCode: string;
  correctiveClass: string;
  blocks: ConfigurationBlock;
}

export interface ProductionConfigurationAssessment {
  environment: "development" | "test" | "production";
  startupBlocked: boolean;
  readinessBlocked: boolean;
  issues: SafeConfigurationIssue[];
}

type Environment = Readonly<Record<string, string | undefined>>;

const PLACEHOLDER_PATTERN = /(?:replace-with|placeholder|change[-_ ]?me|example\.invalid|your[-_ ]?(?:key|secret|token)|^\s*(?:user|password)\s*$)/i;
const LOCAL_HOST_PATTERN = /(?:^|[/:@.])(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?:$|[/:@.])/i;

function hasUsableValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0 && !PLACEHOLDER_PATTERN.test(value));
}

function isSafeProductionUrl(value: string | undefined, options: { database?: boolean } = {}): boolean {
  if (!hasUsableValue(value) || LOCAL_HOST_PATTERN.test(value!)) return false;

  try {
    const parsed = new URL(value!);
    if (options.database) return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function issue(
  capability: string,
  reasonCode: string,
  correctiveClass: string,
  blocks: ConfigurationBlock
): SafeConfigurationIssue {
  return { capability, reasonCode, correctiveClass, blocks };
}

/**
 * Evaluates configuration without returning values or attempting provider calls.
 * It deliberately accepts optional integrations being disabled; their dependent
 * capabilities are reported as unavailable by the readiness registry instead.
 */
export function evaluateProductionConfiguration(
  source: Environment = process.env
): ProductionConfigurationAssessment {
  const isProduction = source.NODE_ENV === "production";
  const issues: SafeConfigurationIssue[] = [];

  if (!isProduction) {
    return { environment: source.NODE_ENV === "test" ? "test" : "development", startupBlocked: false, readinessBlocked: false, issues };
  }

  if (!isSafeProductionUrl(source.DATABASE_URL, { database: true })) {
    issues.push(issue("database", "DATABASE_URL_UNSAFE", "PRODUCTION_DATABASE_CONFIGURATION", "STARTUP"));
  }

  if (!isSafeProductionUrl(source.NEXT_PUBLIC_APP_URL)) {
    issues.push(issue("application", "APP_URL_UNSAFE", "HTTPS_PUBLIC_ORIGIN", "STARTUP"));
  }

  if (source.KT_RUNTIME_ENV === "e2e" || source.KT_E2E_RATE_LIMIT_MODE === "relaxed" || source.E2E_ROUTE_PROVIDER === "deterministic") {
    issues.push(issue("application", "TEST_BYPASS_ENABLED", "REMOVE_TEST_ONLY_RUNTIME_FLAGS", "STARTUP"));
  }

  if (!hasUsableValue(source.REDIS_URL)) {
    issues.push(issue("rate_limiting", "DISTRIBUTED_STORE_UNCONFIGURED", "SHARED_RATE_LIMIT_STORE", "READINESS"));
  }

  const checkoutEnabled = source.CHECKOUT_PUBLIC_ENABLED === "true";
  const payfast = resolvePayfastConfiguration(source);
  if (checkoutEnabled && (!payfast.runtime || payfast.state.environment !== "production")) {
    issues.push(issue("checkout", "PAYMENT_AUTHORITY_UNAVAILABLE", "APPROVED_LIVE_PAYMENT_CONFIGURATION", "READINESS"));
  }

  if (checkoutEnabled && !hasUsableValue(source.PAYFAST_PASSPHRASE)) {
    issues.push(issue("checkout", "PAYMENT_CREDENTIAL_UNSAFE", "PAYMENT_CREDENTIAL_ROTATION", "READINESS"));
  }

  if (source.EMAIL_PROVIDER === "console") {
    issues.push(issue("transactional_email", "CONSOLE_DELIVERY_DISABLED", "APPROVED_EMAIL_PROVIDER", "NONE"));
  }

  if (!source.REPORT_ARTIFACT_STORAGE || source.REPORT_ARTIFACT_STORAGE === "local") {
    issues.push(issue("report_artifacts", "LOCAL_STORAGE_NOT_PRODUCTION_APPROVED", "DURABLE_ARTIFACT_STORAGE", "READINESS"));
  }

  const privateMediaReady = source.PRIVATE_MEDIA_STORAGE === "s3"
    && hasUsableValue(source.PRIVATE_MEDIA_S3_ENDPOINT)
    && hasUsableValue(source.PRIVATE_MEDIA_S3_BUCKET)
    && hasUsableValue(source.PRIVATE_MEDIA_S3_REGION)
    && hasUsableValue(source.PRIVATE_MEDIA_S3_ACCESS_KEY_ID)
    && hasUsableValue(source.PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY);
  if (!privateMediaReady) {
    issues.push(issue("private_media", "PRIVATE_MEDIA_STORAGE_UNCONFIGURED", "DURABLE_PRIVATE_OBJECT_STORAGE", "READINESS"));
  }

  if (source.CORS_ALLOW_ORIGIN === "*") {
    issues.push(issue("request_boundary", "CORS_WILDCARD_FORBIDDEN", "EXPLICIT_TRUSTED_ORIGINS", "STARTUP"));
  }

  if (source.KT_ALLOW_DEMO_SEED === "true") {
    issues.push(issue("database", "DEMO_SEED_AUTHORIZATION_FORBIDDEN", "REMOVE_DEMO_SEED_AUTHORIZATION", "STARTUP"));
  }

  return {
    environment: "production",
    startupBlocked: issues.some((candidate) => candidate.blocks === "STARTUP"),
    readinessBlocked: issues.some((candidate) => candidate.blocks === "STARTUP" || candidate.blocks === "READINESS"),
    issues,
  };
}

export function assertProductionConfiguration(source: Environment = process.env): void {
  const assessment = evaluateProductionConfiguration(source);
  if (!assessment.startupBlocked) return;

  const codes = assessment.issues
    .filter((candidate) => candidate.blocks === "STARTUP")
    .map((candidate) => candidate.reasonCode)
    .join(",");
  throw new Error(`Production configuration rejected: ${codes}`);
}

export function isPlaceholderValue(value: string | undefined): boolean {
  return !hasUsableValue(value);
}
