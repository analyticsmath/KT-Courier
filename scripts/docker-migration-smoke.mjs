import process from "node:process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDisposableSmokeIdentity,
  assertSuccess,
  getDisposableSmokeSeedComposeArgs,
  getSchemaVerifierComposeArgs,
  isSchemaDiffVerbose,
  normalComposeProject,
  runCompose,
  safeError,
  safeLog,
  waitForServiceHealth,
} from "./docker-common.mjs";

export const MIGRATION_SMOKE_COMPOSE_OVERRIDE = "compose.migration-smoke.yml";
export const MIGRATION_SMOKE_EXTRA_COMPOSE_FILES = [MIGRATION_SMOKE_COMPOSE_OVERRIDE];

const projectName = process.env.KT_SMOKE_PROJECT_NAME || "kt-couriers-baseline-smoke";
export const smokeEnv = {
  ...process.env,
  POSTGRES_DB: "kt_courier_baseline_smoke",
  POSTGRES_USER: "kt_courier_baseline_smoke",
  POSTGRES_PASSWORD: "smoke_local_only_password",
  SHADOW_POSTGRES_DB: "kt_courier_baseline_smoke_shadow",
  DATABASE_URL:
    "postgresql://kt_courier_baseline_smoke:smoke_local_only_password@db:5432/kt_courier_baseline_smoke?schema=public",
  SHADOW_DATABASE_URL:
    "postgresql://kt_courier_baseline_smoke:smoke_local_only_password@db:5432/kt_courier_baseline_smoke_shadow?schema=public",
  APP_PORT: "3100",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  EMAIL_PROVIDER: "console",
};

const smokeComposeOptions = {
  projectName,
  env: smokeEnv,
  extraComposeFiles: MIGRATION_SMOKE_EXTRA_COMPOSE_FILES,
};

const expectedMigrations = readdirSync(path.join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-(baseline-smoke|ci-|.*-ci-)/.test(projectName)) {
    throw new Error(`Refusing to remove volumes for non-disposable Compose project ${projectName}.`);
  }
}

async function cleanup() {
  safeLog("Fresh baseline migration smoke: removing only the disposable smoke project volume.");
  const result = runCompose(["down", "-v", "--remove-orphans"], smokeComposeOptions);
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Smoke cleanup failed.");
}

async function main() {
  assertDisposableProject();
  safeLog(`Fresh baseline migration smoke project: ${projectName}`);
  assertSuccess(runCompose(["config", "--quiet"], smokeComposeOptions), "compose config");
  assertSuccess(runCompose(["build", "migrate", "seed"], smokeComposeOptions), "fresh migrator build");
  assertSuccess(runCompose(["up", "-d", "db"], smokeComposeOptions), "smoke db startup");

  const dbHealth = await waitForServiceHealth("db", {
    ...smokeComposeOptions,
    timeoutMs: 150_000,
  });
  if (dbHealth !== "healthy") throw new Error(`smoke db did not become healthy; final status: ${dbHealth}`);

  assertSuccess(runCompose(["run", "--rm", "migrate"], smokeComposeOptions), "fresh migrate deploy");
  assertSuccess(
    runCompose(["run", "--rm", "migrate", "npx", "prisma", "migrate", "status"], smokeComposeOptions),
    "fresh migration status"
  );
  if (isSchemaDiffVerbose(smokeEnv)) {
    safeLog("Schema drift verbose reporting: ENABLED");
  }
  assertSuccess(
    runCompose(
      getSchemaVerifierComposeArgs(smokeEnv),
      smokeComposeOptions
    ),
    "fresh database-to-schema diff"
  );
  const migrationRecordInspection = runCompose(
    [
      "exec",
      "-T",
      "db",
      "sh",
      "-lc",
        "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"SELECT migration_name FROM \\\"_prisma_migrations\\\" WHERE finished_at IS NULL ORDER BY migration_name;\"",
    ],
    smokeComposeOptions
  );
  assertSuccess(migrationRecordInspection, "fresh migration record inspection");
  if (migrationRecordInspection.stdout.trim()) {
    throw new Error("Fresh database contains unfinished migration records.");
  }

  const applied = runCompose(
    ["exec", "-T", "db", "sh", "-lc", "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"SELECT migration_name FROM \\\"_prisma_migrations\\\" ORDER BY migration_name;\""],
    smokeComposeOptions
  );
  assertSuccess(applied, "applied migration inspection");
  const appliedNames = applied.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+_.+/.test(line));
  if (JSON.stringify(appliedNames) !== JSON.stringify(expectedMigrations)) {
    throw new Error(`Fresh database migration chain does not match the repository migration chain (expected ${expectedMigrations.join(", ")}; applied ${appliedNames.join(", ") || "none"}).`);
  }

  assertDisposableSmokeIdentity(projectName, smokeEnv);

  safeLog("First disposable smoke seed authorization: ENABLED");
  safeLog(`Seed target authorization: project=${projectName} database=${smokeEnv.POSTGRES_DB} host=db authorized=true`);
  assertSuccess(
    runCompose(getDisposableSmokeSeedComposeArgs({ service: "seed" }), smokeComposeOptions),
    "first smoke seed"
  );

  safeLog("Second disposable smoke seed authorization: ENABLED");
  safeLog(`Seed target authorization: project=${projectName} database=${smokeEnv.POSTGRES_DB} host=db authorized=true`);
  assertSuccess(
    runCompose(getDisposableSmokeSeedComposeArgs({ service: "seed" }), smokeComposeOptions),
    "second smoke seed"
  );

  safeLog("Fresh migration smoke passed: the complete migration chain, idempotent seed, and schema drift check succeeded from an empty database.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let failed = false;
  try {
    await main();
  } catch (error) {
    failed = true;
    safeError(error instanceof Error ? error.message : String(error));
  } finally {
    await cleanup();
  }

  process.exit(failed ? 1 : 0);
}

