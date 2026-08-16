import { loadLocalEnv, runCompose, safeLog } from "./docker-common.mjs";
import { assertDestructiveResetAllowed } from "../lib/security/seed-safety";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

/**
 * Validates destructive reset safety using the single canonical safety authority in lib/security/seed-safety.ts.
 */
export function validateDestructiveResetSafety(env: Record<string, string | undefined>) {
  const result = assertDestructiveResetAllowed({
    nodeEnv: env.NODE_ENV,
    classification: env.KT_DATABASE_CLASSIFICATION,
    allowDemoSeed: env.KT_ALLOW_DEMO_SEED,
    dbUrl: env.DATABASE_URL,
    targetDbName: "kt_courier_demo_full",
  });

  return {
    currentDbName: result.dbName,
    host: result.host,
    port: result.port,
  };
}

export function checkAndBackupDatabase() {
  const env = loadLocalEnv() as Record<string, string | undefined>;
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
  if (dumpResult.status === 0 && dumpResult.stdout && dumpResult.stdout.length > 50) {
    writeFileSync(backupFilePath, dumpResult.stdout);
    safeLog(`✓ Safety backup created successfully at ${backupFilePath}`);
  } else {
    safeLog("⚠️  Database appears empty or uninitialized. Skipping dump save.");
  }
}
