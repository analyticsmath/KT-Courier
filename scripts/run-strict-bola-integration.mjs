import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import {
  assertSuccess,
  normalComposeProject,
  runCompose,
  runDocker,
  safeError,
  safeLog,
  startDisposableComposeWithPortRetry,
  waitForServiceHealth,
} from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-ci-bola-${nonce}`;
const database = `kt_bola_${process.pid}`;
const password = "bola_disposable_only";

function buildEnv(port) {
  return {
    ...process.env,
    POSTGRES_DB: database,
    POSTGRES_USER: database,
    POSTGRES_PASSWORD: password,
    SHADOW_POSTGRES_DB: `${database}_shadow`,
    POSTGRES_PORT: String(port),
    DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
    SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
    EMAIL_PROVIDER: "console",
    STRICT_POSTGRES_REQUIRED: "1",
    KT_ALLOW_POSTGRES_INTEGRATION_TESTS: "1",
    KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true",
  };
}

let env = buildEnv(5432);

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-ci-bola-/.test(projectName)) {
    throw new Error("Refusing to operate on a non-disposable BOLA project.");
  }
}

async function cleanup() {
  assertDisposableProject();
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Disposable BOLA cleanup failed.");
}

let failed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  safeLog("[STRICT_BOLA_RUNNER] Starting disposable PostgreSQL database for BOLA authority matrix...");
  const started = await startDisposableComposeWithPortRetry({ projectName, buildEnv });
  env = started.env;

  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") {
    throw new Error("Disposable BOLA database did not become healthy.");
  }

  safeLog("[STRICT_BOLA_RUNNER] Deploying forward migrations to fresh BOLA database (no demo seed)...");
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "BOLA migration deploy");

  safeLog("[STRICT_BOLA_RUNNER] PostgreSQL is ready. Executing strict BOLA database authority matrix...");
  const testResult = spawnSync(
    process.execPath,
    [path.join("node_modules", "vitest", "vitest.mjs"), "run", "tests/security/bola-database-authority.integration.test.ts"],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      encoding: "utf8",
      shell: false,
    }
  );

  if (testResult.status !== 0) {
    throw new Error("Strict BOLA integration matrix failed.");
  }

  safeLog("[STRICT_BOLA_RUNNER] Strict PostgreSQL BOLA matrix PASSED.");
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
