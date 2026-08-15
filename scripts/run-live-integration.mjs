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
  waitForServiceHealth,
} from "./docker-common.mjs";

const suite = process.argv[2];
const suiteFiles = {
  auth: ["tests/integration/auth-session.integration.test.ts"],
  permissions: ["tests/integration/permissions.integration.test.ts"],
  orders: ["tests/integration/orders-pricing.integration.test.ts"],
  pricing: ["tests/integration/pricing-quote.integration.test.ts", "tests/integration/pricing-concurrency.integration.test.ts"],
  dispatch: ["tests/integration/dispatch-concurrency.integration.test.ts", "tests/integration/dispatch-lifecycle.integration.test.ts"],
  "cross-module": ["tests/integration/phase7-5-cross-module.integration.test.ts"],
};

if (!suiteFiles[suite]) {
  safeError("A supported live integration suite is required.");
  process.exit(1);
}

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-ci-phase75-${suite}-${nonce}`;
const database = `kt_phase75_${suite.replace(/[^a-z0-9]/g, "_")}`;
const port = String(56000 + (process.pid % 700));
const password = "phase75_disposable_only";
const env = {
  ...process.env,
  POSTGRES_DB: database,
  POSTGRES_USER: database,
  POSTGRES_PASSWORD: password,
  SHADOW_POSTGRES_DB: `${database}_shadow`,
  POSTGRES_PORT: port,
  DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
  SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
  EMAIL_PROVIDER: "console",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  KT_ALLOW_DEMO_SEED: "true",
  KT_DATABASE_CLASSIFICATION: "development",
};

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-ci-phase75-/.test(projectName)) {
    throw new Error("Refusing to remove a non-disposable integration project.");
  }
}

function runVitest() {
  const result = spawnSync(process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.integration.config.ts", ...suiteFiles[suite]], {
    cwd: process.cwd(),
    env,
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${suite} live integration tests failed.`);
}

async function cleanup() {
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Disposable integration cleanup failed.");
}

let failed = false;
try {
  assertDisposableProject();
  safeLog(`Live integration suite: ${suite}.`);
  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "integration compose config");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "integration database startup");
  const health = await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 });
  if (health !== "healthy") throw new Error(`integration database did not become healthy (${health}).`);
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "integration migration deploy");
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "integration seed");
  runVitest();
  safeLog(`Live ${suite} integration suite passed.`);
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
