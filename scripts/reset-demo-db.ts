import { loadLocalEnv, runCompose, safeError, safeLog } from "./docker-common.mjs";
import { checkAndBackupDatabase, validateDestructiveResetSafety } from "./demo-db-safety";
import process from "node:process";
import { execSync } from "node:child_process";

async function main() {
  safeLog("Starting KT Couriers Demo Database Reset...");
  checkAndBackupDatabase();

  const env = loadLocalEnv() as Record<string, string | undefined>;
  const { currentDbName } = validateDestructiveResetSafety(env);

  // Immediate pre-drop re-verification
  const preDropEnv = loadLocalEnv() as Record<string, string | undefined>;
  const verifiedTarget = validateDestructiveResetSafety(preDropEnv);
  if (verifiedTarget.currentDbName !== currentDbName) {
    throw new Error(`Target database changed unexpectedly from '${currentDbName}' to '${verifiedTarget.currentDbName}'. Aborting reset.`);
  }

  safeLog(`Resetting schema for verified dedicated demo database '${verifiedTarget.currentDbName}' on ${verifiedTarget.host}:${verifiedTarget.port}...`);
  const resetSql = "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO kt_courier; GRANT ALL ON SCHEMA public TO public;";
  
  const res = runCompose(
    ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", verifiedTarget.currentDbName],
    { input: resetSql }
  );

  if (res.status !== 0) {
    safeError(`Failed to reset schema in '${verifiedTarget.currentDbName}': ${res.stderr}`);
    process.exit(1);
  }

  safeLog("✓ Schema reset cleanly. Re-applying migration chain...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  execSync("npx prisma generate", { stdio: "inherit" });

  safeLog("🎉 Demo database reset successfully complete.");
}

main().catch((err) => {
  safeError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
