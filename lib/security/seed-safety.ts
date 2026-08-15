export type DatabaseClassification = "development" | "test" | "staging" | "production";

export interface SeedSafetyInput {
  nodeEnv?: string;
  classification?: string;
  allowDemoSeed?: string | boolean;
  dbUrl?: string;
}

export interface DestructiveResetSafetyInput extends SeedSafetyInput {
  targetDbName?: string;
}

export class SeedSafetyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SeedSafetyError";
  }
}

export const DEDICATED_DEMO_DB_NAME = "kt_courier_demo_full";
export const DEDICATED_DEMO_DB_PATTERN = /^(?:kt_courier_demo(?:_[a-z0-9_]+)?|kt_courier_test(?:_[a-z0-9_]+)?|.+_disposable)$/i;
export const RESERVED_PRIMARY_DB_NAMES = new Set([
  "kt_courier",
  "kt_courier_dev",
  "kt_courier_development",
  "kt_courier_production",
  "kt_courier_staging",
  "postgres",
  "template1",
]);

export const LOCAL_HOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * Sanitizes a URL or error message to remove passwords and sensitive parameters.
 */
export function sanitizeConnectionDetails(rawUrl: string | undefined): string {
  if (!rawUrl) return "[UNSPECIFIED]";
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.username ? parsed.username + "@" : ""}${parsed.hostname}:${parsed.port || "default"}${parsed.pathname}`;
  } catch {
    return "[MALFORMED_URL]";
  }
}

/**
 * Verifies that a database URL points to a dedicated demo or test database on a local/disposable host.
 */
export function assertDemoDatabaseIdentity(rawDbUrl?: string): { dbName: string; host: string; port: string } {
  const dbUrl = rawDbUrl ?? process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim().length === 0) {
    throw new SeedSafetyError("DATABASE_URL_MISSING", "DATABASE_URL environment variable is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new SeedSafetyError("DATABASE_URL_MALFORMED", "DATABASE_URL is not a valid URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new SeedSafetyError("DATABASE_URL_INVALID_PROTOCOL", `Expected postgres/postgresql protocol, got '${parsed.protocol}'.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOST_NAMES.has(host)) {
    throw new SeedSafetyError(
      "DATABASE_HOST_NOT_LOCAL",
      `Refusing destructive demo operation against non-local host '${host}'.`
    );
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim();
  if (!dbName) {
    throw new SeedSafetyError("DATABASE_NAME_MISSING", "Database name could not be extracted from DATABASE_URL.");
  }

  if (RESERVED_PRIMARY_DB_NAMES.has(dbName.toLowerCase())) {
    throw new SeedSafetyError(
      "DATABASE_TARGET_RESERVED",
      `Refusing destructive demo operation on primary/reserved database '${dbName}'. A dedicated demo/test database name (e.g. '${DEDICATED_DEMO_DB_NAME}') is required.`
    );
  }

  if (!DEDICATED_DEMO_DB_PATTERN.test(dbName)) {
    throw new SeedSafetyError(
      "DATABASE_TARGET_NOT_DEMO",
      `Database '${dbName}' does not match dedicated demo/test pattern (${DEDICATED_DEMO_DB_PATTERN.source}).`
    );
  }

  return { dbName, host, port: parsed.port || "5432" };
}

/**
 * Asserts whether database seeding is permitted based on environment variables.
 * Fails closed in production, staging, ambiguous environments, or when explicit authorization is missing.
 * Never prints connection strings or passwords in errors.
 */
export function assertSeedExecutionAllowed(input?: SeedSafetyInput): void {
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV;
  const rawClassification = input?.classification ?? process.env.KT_DATABASE_CLASSIFICATION ?? "development";
  const classification = rawClassification.toLowerCase();
  const allowDemo = input?.allowDemoSeed ?? process.env.KT_ALLOW_DEMO_SEED;

  // 1. Refuse in production NODE_ENV
  if (nodeEnv === "production") {
    throw new SeedSafetyError("SEED_REJECTED_PRODUCTION_ENV", "Seed execution is strictly prohibited when NODE_ENV is production.");
  }

  // 2. Refuse when database classification is production
  if (classification === "production") {
    throw new SeedSafetyError("SEED_REJECTED_PRODUCTION_CLASSIFICATION", "Seed execution is strictly prohibited for production databases.");
  }

  // 3. Refuse when database classification is staging by default
  if (classification === "staging") {
    throw new SeedSafetyError("SEED_REJECTED_STAGING_CLASSIFICATION", "Seed execution is prohibited for staging databases by default.");
  }

  // 4. Validate classification value
  if (classification !== "development" && classification !== "test") {
    throw new SeedSafetyError(
      "SEED_REJECTED_AMBIGUOUS_CLASSIFICATION",
      `Ambiguous or unrecognized database classification: '${rawClassification}'.`
    );
  }

  // 5. Require explicit demo seed authorization (or NODE_ENV=test)
  const isTest = nodeEnv === "test" || classification === "test";
  const isAuthorized = allowDemo === true || allowDemo === "true" || allowDemo === "1";

  if (!isTest && !isAuthorized) {
    throw new SeedSafetyError(
      "SEED_REJECTED_UNAUTHORIZED",
      "Seed execution requires explicit authorization (set KT_ALLOW_DEMO_SEED=true)."
    );
  }

  // 6. If dbUrl is provided, verify target database safety
  if (input?.dbUrl) {
    assertDemoDatabaseIdentity(input.dbUrl);
  }
}

/**
 * Asserts whether a destructive database reset/drop-schema operation is allowed.
 * Strictly requires:
 * 1. assertSeedExecutionAllowed checks passed
 * 2. Dedicated demo database identity verified
 * 3. Local/disposable host only
 * 4. Explicit targetDbName matches current DATABASE_URL
 */
export function assertDestructiveResetAllowed(input?: DestructiveResetSafetyInput): { dbName: string; host: string; port: string } {
  assertSeedExecutionAllowed(input);
  const target = assertDemoDatabaseIdentity(input?.dbUrl);

  if (input?.targetDbName && input.targetDbName.toLowerCase() !== target.dbName.toLowerCase()) {
    throw new SeedSafetyError(
      "DATABASE_TARGET_MISMATCH",
      `Target database '${input.targetDbName}' does not match DATABASE_URL target '${target.dbName}'.`
    );
  }

  return target;
}
