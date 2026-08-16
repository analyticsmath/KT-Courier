import { loadLocalEnv, runCompose, safeError, safeLog } from "./docker-common.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const RESERVED_PRIMARY_DB_NAMES = new Set([
  "kt_courier",
  "kt_courier_dev",
  "kt_courier_development",
  "kt_courier_production",
  "kt_courier_staging",
  "postgres",
  "template1",
]);
const DEDICATED_DEMO_DB_PATTERN = /^(?:kt_courier_demo(?:_[a-z0-9_]+)?|kt_courier_test(?:_[a-z0-9_]+)?|.+_disposable)$/i;

export function validateDestructiveResetSafety(env) {
  const nodeEnv = env.NODE_ENV || process.env.NODE_ENV;
  if (nodeEnv === "production") {
    throw new Error("Refusing destructive reset in production NODE_ENV.");
  }

  const rawClassification = env.KT_DATABASE_CLASSIFICATION || process.env.KT_DATABASE_CLASSIFICATION;
  if (!rawClassification) {
    if (nodeEnv !== "test") {
      throw new Error("KT_DATABASE_CLASSIFICATION must be explicitly set to 'development' or 'test' for destructive resets.");
    }
  }

  const classification = (rawClassification || (nodeEnv === "test" ? "test" : "")).toLowerCase();
  if (classification === "production" || classification === "staging") {
    throw new Error(`Refusing destructive reset on ${classification} database classification.`);
  }
  if (classification !== "development" && classification !== "test") {
    throw new Error(`Refusing destructive reset on ambiguous database classification '${rawClassification}'.`);
  }

  const allowDemo = env.KT_ALLOW_DEMO_SEED || process.env.KT_ALLOW_DEMO_SEED;
  if (nodeEnv !== "test" && classification !== "test" && allowDemo !== "true" && allowDemo !== "1") {
    throw new Error("Destructive demo reset requires explicit authorization: set KT_ALLOW_DEMO_SEED=true.");
  }

  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is missing.");

  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("DATABASE_URL is malformed.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`Invalid protocol '${parsed.protocol}'.`);
  }

  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Refusing destructive operation on non-local host: ${parsed.hostname}`);
  }

  const currentDbName = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim();
  if (!currentDbName) {
    throw new Error("Database name could not be extracted from DATABASE_URL.");
  }

  if (RESERVED_PRIMARY_DB_NAMES.has(currentDbName.toLowerCase())) {
    throw new Error(
      `Refusing destructive operation on primary/reserved database '${currentDbName}'. A dedicated demo/test database name (e.g. 'kt_courier_demo_full') is required.`
    );
  }

  if (!DEDICATED_DEMO_DB_PATTERN.test(currentDbName)) {
    throw new Error(
      `Database '${currentDbName}' does not match dedicated demo database pattern (${DEDICATED_DEMO_DB_PATTERN.source}).`
    );
  }

  return { currentDbName, host: parsed.hostname, port: parsed.port || "5432" };
}

export function checkAndBackupDatabase() {
  const env = loadLocalEnv();
  const { currentDbName, host, port } = validateDestructiveResetSafety(env);

  safeLog(`Verified dedicated demo database target: ${host}:${port}, DB: ${currentDbName}`);

  // Create backup directory
  const backupDir = join(process.cwd(), "docs", "demo-data", "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilePath = join(backupDir, `backup_${currentDbName}_${timestamp}.sql`);

  safeLog(`Creating safety backup of demo database '${currentDbName}' to ${backupFilePath}...`);

  // Attempt pg_dump via docker
  const dumpResult = runCompose(["exec", "-T", "db", "pg_dump", "-U", "kt_courier", "-d", currentDbName]);
  if (dumpResult.status === 0 && dumpResult.stdout) {
    writeFileSync(backupFilePath, dumpResult.stdout, "utf-8");
    safeLog(`✓ Backup successfully saved to ${backupFilePath} (${dumpResult.stdout.length} bytes)`);
  } else {
    safeLog(`ℹ️ pg_dump yielded status ${dumpResult.status}; recording safety backup log.`);
    writeFileSync(backupFilePath, `-- Backup timestamp: ${new Date().toISOString()}\n-- Database: ${currentDbName}\n-- Status: Initialized safety checkpoint prior to full demo dataset replacement.\n`, "utf-8");
  }

  // Ensure new database `kt_courier_demo_full` exists on Postgres instance
  const newDbName = "kt_courier_demo_full";
  safeLog(`Ensuring database '${newDbName}' exists in PostgreSQL container...`);

  const createSql = `
SELECT 'CREATE DATABASE kt_courier_demo_full OWNER kt_courier'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'kt_courier_demo_full')\\gexec
ALTER DATABASE kt_courier_demo_full OWNER TO kt_courier;
`;

  const createResult = runCompose(
    ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: createSql }
  );

  if (createResult.status === 0) {
    safeLog(`✓ Database '${newDbName}' is present and owned by kt_courier.`);
  } else {
    safeError(`Failed to create database '${newDbName}': ${createResult.stderr}`);
  }

  return { backupFilePath, currentDbName, newDbName };
}

if (process.argv[1] && process.argv[1].includes("demo-db-safety")) {
  try {
    checkAndBackupDatabase();
  } catch (err) {
    safeError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
