import { loadLocalEnv, runCompose, safeError, safeLog } from "./docker-common.mjs";
import { checkAndBackupDatabase } from "./demo-db-safety.mjs";
import process from "node:process";
import { execSync } from "node:child_process";

async function main() {
  safeLog("Starting KT Couriers Demo Database Reset...");
  checkAndBackupDatabase();

  const env = loadLocalEnv();
  const dbUrl = env.DATABASE_URL;
  const url = new URL(dbUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  safeLog(`Resetting schema for local database '${dbName}'...`);
  const resetSql = "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO kt_courier; GRANT ALL ON SCHEMA public TO public;";
  
  const res = runCompose(
    ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", dbName],
    { input: resetSql }
  );

  if (res.status !== 0) {
    safeError(`Failed to reset schema in '${dbName}': ${res.stderr}`);
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
