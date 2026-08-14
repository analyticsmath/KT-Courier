import process from "node:process";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assertDisposableGate4Identity,
  assertSuccess,
  getSchemaVerifierComposeArgs,
  isSchemaDiffVerbose,
  normalComposeProject,
  runCompose,
  runDocker,
  safeError,
  safeLog,
  waitForServiceHealth,
} from "./docker-common.mjs";

const projectName = process.env.KT_GATE4_PROJECT_NAME || "kt-couriers-gate4";
const port = process.env.KT_GATE4_POSTGRES_PORT || "55834";
const dbName = "kt_courier_gate4_disposable";
const dbUser = "kt_courier_gate4_disposable";
const dbPass = "gate4_local_only_password";

const gate4Env = {
  ...process.env,
  POSTGRES_DB: dbName,
  POSTGRES_USER: dbUser,
  POSTGRES_PASSWORD: dbPass,
  SHADOW_POSTGRES_DB: `${dbName}_shadow`,
  POSTGRES_PORT: port,
  APP_PORT: "3104",
  NEXT_PUBLIC_APP_URL: "http://localhost:3104",
  EMAIL_PROVIDER: "console",
};

export function constructGate4DatabaseUrl(host = "localhost", hostPort = port) {
  return `postgresql://${dbUser}:${dbPass}@${host}:${hostPort}/${dbName}?schema=public`;
}

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-(gate4|ci-gate4)/.test(projectName)) {
    throw new Error(`Refusing to execute Gate 4 for non-disposable Compose project ${projectName}.`);
  }
}

async function cleanup() {
  safeLog("Gate 4 docker execution: removing only the disposable Gate 4 project container and volume.");
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env: gate4Env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Gate 4 cleanup failed.");
}

async function main() {
  assertDisposableProject();
  assertDisposableGate4Identity(projectName, gate4Env);
  assertSuccess(
    spawnSync(process.execPath, [path.join("scripts", "source-schema-preflight.mjs"), "--suite", "gate4"], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      shell: false,
    }),
    "local source/schema preflight",
  );

  safeLog("=========================================================================");
  safeLog("   KT COURIER — GATE 4 DISPOSABLE POSTGRESQL DOCKER HARNESS ORCHESTRATOR ");
  safeLog("=========================================================================\n");

  safeLog(`Gate 4 Disposable Project: ${projectName}`);
  safeLog(`Target Host Port: ${port}`);
  safeLog(`Target Database: ${dbName}`);

  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env: gate4Env }), "compose config");
  assertSuccess(runCompose(["build", "db", "migrate"], { projectName, env: gate4Env }), "docker compose build");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env: gate4Env }), "gate4 db startup");

  const dbHealth = await waitForServiceHealth("db", {
    projectName,
    env: gate4Env,
    timeoutMs: 150_000,
  });
  if (dbHealth !== "healthy") throw new Error(`Gate 4 db did not become healthy; final status: ${dbHealth}`);

  safeLog("\n▶ Running Prisma migrate deploy on disposable Gate 4 database...");
  assertSuccess(runCompose(["run", "--rm", "migrate"], { projectName, env: gate4Env }), "migrate deploy service");
  
  safeLog("▶ Verifying Prisma migration status...");
  assertSuccess(
    runCompose(["run", "--rm", "migrate", "npx", "prisma", "migrate", "status"], {
      projectName,
      env: gate4Env,
    }),
    "migration status"
  );

  if (isSchemaDiffVerbose(gate4Env)) {
    safeLog("Schema drift verbose reporting: ENABLED");
  }
  
  safeLog("▶ Verifying zero database-to-schema drift...");
  assertSuccess(
    runCompose(
      getSchemaVerifierComposeArgs(gate4Env),
      { projectName, env: gate4Env }
    ),
    "database-to-schema diff"
  );

  const localDatabaseUrl = constructGate4DatabaseUrl("localhost", port);
  safeLog(`\n✔ Disposable Gate 4 PostgreSQL environment ready at localhost:${port}`);

  safeLog("\n▶ Executing Gate 4 integration suite against disposable PostgreSQL instance...\n");

  const suiteProcess = spawnSync(
    process.execPath,
    [path.join("scripts", "run-gate4-integration.mjs")],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: localDatabaseUrl,
        KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
        KT_GATE4_INTEGRATION_APPROVED: "1",
        KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
      },
      stdio: "inherit",
      shell: false,
    }
  );

  if (suiteProcess.status !== 0) {
    throw new Error(`Gate 4 integration test runner failed with exit code ${suiteProcess.status ?? 1}`);
  }

  safeLog("\n=========================================================================");
  safeLog("   GATE 4 DISPOSABLE POSTGRESQL INTEGRATION HARNESS RUN: PASSED          ");
  safeLog("=========================================================================");
}

import { fileURLToPath } from "node:url";

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
