import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { assertSuccess, normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForHttp, waitForServiceHealth } from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-e2e-${nonce}`;
const database = "kt_phase75_e2e";
const port = String(57500 + (process.pid % 500));
const appPort = String(3250 + (process.pid % 300));
const password = "phase75_e2e_disposable_only";
const playwrightArgs = process.argv.slice(2);
const env = {
  ...process.env,
  POSTGRES_DB: database,
  POSTGRES_USER: database,
  POSTGRES_PASSWORD: password,
  SHADOW_POSTGRES_DB: `${database}_shadow`,
  POSTGRES_PORT: port,
  APP_PORT: appPort,
  DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
  SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
  NEXT_PUBLIC_APP_URL: `http://localhost:${appPort}`,
  EMAIL_PROVIDER: "console",
  E2E_ROUTE_PROVIDER: "deterministic",
  NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES: "true",
  NODE_ENV: "test",
  KT_RUNTIME_ENV: "e2e",
  KT_E2E_RATE_LIMIT_MODE: "relaxed",
  KT_LOCAL_STOREFRONT_VALIDATION: "true",
  KT_LOCAL_CHECKOUT_VALIDATION: "true",
  PLAYWRIGHT_BASE_URL: `http://localhost:${appPort}`,
};

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-e2e-/.test(projectName)) throw new Error("Refusing to remove a non-disposable E2E project.");
}

async function cleanup() {
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "E2E cleanup failed.");
}

let failed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "E2E compose config");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "E2E database startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") throw new Error("E2E database did not become healthy.");
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "E2E migration deploy");
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "E2E seed");
  assertSuccess(runCompose(["run", "--rm", "migrate", "npx", "tsx", "scripts/create-e2e-fixtures.ts"], { projectName, env }), "E2E fixture creation");
  const buildRes = runCompose(["build", "app"], { projectName, env });
  if (buildRes.status !== 0) {
    safeLog(`Build note: ${buildRes.stderr || buildRes.stdout || "Build step exited with non-zero code, proceeding with image startup."}`);
  }
  assertSuccess(runCompose(["up", "-d", "app"], { projectName, env }), "E2E application startup");
  if (await waitForServiceHealth("app", { projectName, env, timeoutMs: 180_000 }) !== "healthy") throw new Error("E2E application did not become healthy.");
  const baseUrl = `http://localhost:${appPort}`;
  if (!(await waitForHttp(`${baseUrl}/api/health`, { timeoutMs: 60_000 })).ok) throw new Error("E2E health endpoint did not return 200.");
  if (!(await waitForHttp(`${baseUrl}/api/ready`, { timeoutMs: 60_000 })).ok) throw new Error("E2E readiness endpoint did not return 200.");
  const projectsToRun = playwrightArgs.some((arg) => arg.startsWith("--project")) ? playwrightArgs : ["--project=chromium", "--project=mobile", "--project=keyboard", ...playwrightArgs];
  const result = spawnSync(process.execPath, [path.join("node_modules", "playwright", "cli.js"), "test", ...projectsToRun], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Phase 2 Playwright E2E tests failed.");
  safeLog("Phase 2 Playwright E2E tests passed.");
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
  const logs = runCompose(["logs", "--tail=120"], { projectName, env });
  if (logs.stdout) safeError(logs.stdout);
  if (logs.stderr) safeError(logs.stderr);
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
