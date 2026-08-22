// Deliberately unexecuted Phase 16 PostgreSQL integration runner. It may run
// only behind consolidated validation and owns a unique Compose project,
// database, shadow database and named volume.
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertSuccess, normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";

if (process.env.KT_STORE_EARNING_INTEGRATION_APPROVED !== "true") {
  safeError("Store earning integration tests are deferred until consolidated validation approves an isolated PostgreSQL run.");
  process.exit(1);
}

const nonce = `${Date.now()}-${process.pid}`;
const projectPrefix = (process.env.KT_SMOKE_PROJECT_NAME ?? "kt-couriers-store-earning").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 42);
const projectName = `${projectPrefix}-${nonce}`;
const database = `kt_store_earning_${process.pid}_${Date.now()}`;
const port = String(57400 + (process.pid % 500));
const password = "phase16_store_earning_disposable_only";
const env = {
  ...process.env,
  KT_SMOKE_PROJECT_NAME: projectName,
  POSTGRES_DB: database,
  POSTGRES_USER: database,
  POSTGRES_PASSWORD: password,
  SHADOW_POSTGRES_DB: `${database}_shadow`,
  POSTGRES_PORT: port,
  DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
  SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
  EMAIL_PROVIDER: "console",
  KT_NETWORK_DISABLED: "true",
  NO_PROXY: "*",
  no_proxy: "*",
  KT_ALLOW_DEMO_SEED: "true",
};

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-store-earning-[a-z0-9-]+/.test(projectName)) throw new Error("Refusing to operate a non-disposable store earning integration project.");
}

async function cleanup() {
  assertDisposableProject();
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Disposable store earning integration cleanup failed.");
}

let failed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "store earning integration compose config");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "store earning integration database startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") throw new Error("Store earning integration database did not become healthy.");
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "store earning integration migration deploy");
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "store earning integration permission seed");
  const result = spawnSync(process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.store-earning-integration.config.ts"], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Store earning integration tests failed.");
  safeLog("Store earning integration validation passed in its disposable project.");
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
