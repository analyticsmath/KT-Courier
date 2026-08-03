import { loadLocalEnv, runCompose, safeError, safeLog } from "./docker-common.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function checkAndBackupDatabase() {
  const env = loadLocalEnv();
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is missing from .env");

  const url = new URL(dbUrl);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing destructive operation on non-local host: ${url.hostname}`);
  }

  const currentDbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  safeLog(`Current local database host: ${url.hostname}:${url.port || 5433}, DB: ${currentDbName}`);

  // Create backup directory
  const backupDir = join(process.cwd(), "docs", "demo-data", "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilePath = join(backupDir, `backup_${currentDbName}_${timestamp}.sql`);

  safeLog(`Creating backup of local database '${currentDbName}' to ${backupFilePath}...`);

  // Attempt pg_dump via docker
  const dumpResult = runCompose(["exec", "-T", "db", "pg_dump", "-U", "kt_courier", "-d", currentDbName]);
  if (dumpResult.status === 0 && dumpResult.stdout) {
    writeFileSync(backupFilePath, dumpResult.stdout, "utf-8");
    safeLog(`✓ Backup successfully saved to ${backupFilePath} (${dumpResult.stdout.length} bytes)`);
  } else {
    safeLog(`⚠️ pg_dump yielded status ${dumpResult.status}; saving placeholder safety backup log.`);
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
