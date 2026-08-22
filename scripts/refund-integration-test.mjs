// Deliberately unexecuted Phase 15 PostgreSQL integration runner. It may run
// only behind consolidated validation and creates/removes its own Compose
// project, database, shadow database and named volume.
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertSuccess, normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";

if (process.env.KT_REFUND_INTEGRATION_APPROVED !== "true") {
  safeError("Refund integration tests are deferred until consolidated validation approves an isolated PostgreSQL run.");
  process.exit(1);
}

const nonce = `${Date.now()}-${process.pid}`;
const projectPrefix = (process.env.KT_SMOKE_PROJECT_NAME ?? "kt-couriers-refund").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 44);
const projectName = `${projectPrefix}-${nonce}`;
const database = `kt_refund_${process.pid}_${Date.now()}`;
const port = String(56800 + (process.pid % 600));
const password = "phase15_refund_disposable_only";
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
  KT_REFUND_PROVIDER_MODE: "deterministic-injected",
  KT_ALLOW_DEMO_SEED: "true",
};

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-refund-[a-z0-9-]+/.test(projectName)) throw new Error("Refusing to operate a non-disposable refund integration project.");
}

async function cleanup() {
  assertDisposableProject();
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Disposable refund integration cleanup failed.");
}

let failed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "refund integration compose config");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "refund integration database startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") throw new Error("Refund integration database did not become healthy.");
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "refund integration migration deploy");
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "refund integration base permission seed");
  const result = spawnSync(process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.refund-integration.config.ts"], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Refund integration tests failed.");
  safeLog("Refund integration validation passed in its disposable project.");
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
