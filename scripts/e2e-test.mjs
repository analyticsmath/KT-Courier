import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { disposableBrowserOrigins } from "./e2e-environment.mjs";
import { runPhase1BrowserPlan } from "./phase1-browser-plan.mjs";
import {
  assertSuccess,
  findAvailableLoopbackPort,
  isHostPortBindingConflict,
  normalComposeProject,
  runCompose as runBaseCompose,
  runDocker,
  safeError,
  safeLog,
  waitForHttp,
  waitForServiceHealth,
} from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-e2e-${nonce}`;
const database = "kt_phase75_e2e";
const password = "phase75_e2e_disposable_only";
const playwrightArgs = process.argv.slice(2);
const phase1Acceptance = playwrightArgs.includes("--phase1-catalog");
if (phase1Acceptance && playwrightArgs.some(arg => !["--phase1-catalog", "--project=chromium"].includes(arg))) throw new Error("Phase 1 acceptance uses its fixed required selections.");

function runCompose(args, options) {
  return runBaseCompose(args, { ...options, extraComposeFiles: ["compose.e2e.yml"] });
}

function buildEnv(port, appPort) {
  return {
    ...process.env,
    POSTGRES_DB: database,
    POSTGRES_USER: database,
    POSTGRES_PASSWORD: password,
    SHADOW_POSTGRES_DB: `${database}_shadow`,
    POSTGRES_PORT: String(port),
    APP_PORT: String(appPort),
    DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
    SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
    NEXT_PUBLIC_APP_URL: `http://localhost:${appPort}`,
    ALLOWED_ORIGINS: disposableBrowserOrigins(appPort),
    EMAIL_PROVIDER: "console",
    // Non-secret test configuration allows pre-payment browser commands. The
    // isolated network prevents provider access; no payment success is invented.
    PAYSTACK_MODE: "test",
    PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider",
    PAYMENT_APP_ORIGIN: `http://localhost:${appPort}`,
    KT_E2E_NETWORK_INTERNAL: "true",
    E2E_ROUTE_PROVIDER: "deterministic",
    KT_NETWORK_DISABLED: "true",
    KT_E2E_GEOCODE_FIXTURES: JSON.stringify({ "45 Commission St, Central, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2041, longitude: 28.0473 } }),
    NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES: "true",
    NODE_ENV: "test",
    KT_RUNTIME_ENV: "e2e",
    KT_E2E_RATE_LIMIT_MODE: "relaxed",
    KT_LOCAL_STOREFRONT_VALIDATION: "true",
    KT_LOCAL_CHECKOUT_VALIDATION: "true",
    PLAYWRIGHT_BASE_URL: `http://localhost:${appPort}`,
  };
}

let env = buildEnv(5432, 3000);
let currentAppPort = "3000";

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-e2e-/.test(projectName)) {
    throw new Error("Refusing to remove a non-disposable E2E project.");
  }
}

async function cleanup() {
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "E2E cleanup failed.");
}

async function startE2EServicesWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let port = await findAvailableLoopbackPort();
    let appPort = await findAvailableLoopbackPort();
    while (appPort === port) {
      appPort = await findAvailableLoopbackPort();
    }
    currentAppPort = String(appPort);
    env = buildEnv(port, appPort);

    assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "E2E compose config");

    // STRICT FATAL GATE: images build must succeed sequentially to avoid concurrent BuildKit memory exhaustion
    assertSuccess(runCompose(["build", "migrate"], { projectName, env }), "E2E migrate build");
    assertSuccess(runCompose(["build", "app"], { projectName, env }), "E2E application build");

    const dbUp = runCompose(["up", "-d", "db"], { projectName, env });
    if (dbUp.status !== 0) {
      const output = (dbUp.stderr || "") + "\n" + (dbUp.stdout || "");
      if (isHostPortBindingConflict(output) && attempt < maxAttempts) {
        safeLog(`E2E DB port ${port} conflict on attempt ${attempt}/${maxAttempts}. Retrying with fresh loopback ports...`);
        runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
        continue;
      }
      throw new Error(`E2E database startup failed on attempt ${attempt}: ${output.trim()}`);
    }

    if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") {
      runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
      throw new Error("E2E database did not become healthy.");
    }

    assertSuccess(runCompose(["run", "--rm", "migrate"], { projectName, env }), "E2E migration deploy");
    assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "E2E seed");
    assertSuccess(runCompose(["run", "--rm", "-e", "NODE_ENV=test", "-e", "KT_RUNTIME_ENV=e2e", "-e", "KT_NETWORK_DISABLED=true", "migrate", "npx", "tsx", "scripts/create-e2e-fixtures.ts"], { projectName, env }), "E2E fixture creation");

    const appUp = runCompose(["up", "-d", "e2e-ingress"], { projectName, env });
    if (appUp.status !== 0) {
      const output = (appUp.stderr || "") + "\n" + (appUp.stdout || "");
      if (isHostPortBindingConflict(output) && attempt < maxAttempts) {
        safeLog(`E2E app port ${appPort} conflict on attempt ${attempt}/${maxAttempts}. Retrying with fresh loopback ports...`);
        runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
        continue;
      }
      throw new Error(`E2E application startup failed on attempt ${attempt}: ${output.trim()}`);
    }

    if (await waitForServiceHealth("app", { projectName, env, timeoutMs: 180_000 }) !== "healthy") {
      const appLogs = runCompose(["logs", "--tail=50", "app"], { projectName, env });
      if (appLogs.stdout) safeError(appLogs.stdout);
      if (appLogs.stderr) safeError(appLogs.stderr);
      runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
      throw new Error("E2E application did not become healthy.");
    }

    return { port, appPort, env };
  }
  throw new Error(`Failed to start E2E environment after ${maxAttempts} attempts.`);
}

let failed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  await startE2EServicesWithRetry(3);

  // Prove provider isolation before any browser can submit a payment command.
  // A literal public address avoids treating a DNS outage as isolation proof.
  assertSuccess(runCompose(["exec", "-T", "app", "node", "-e", "const net=require('node:net'); const s=net.connect({host:'1.1.1.1',port:443}); s.setTimeout(3000); s.once('connect',()=>{s.destroy();process.exit(1)}); s.once('error',()=>process.exit(0)); s.once('timeout',()=>{s.destroy();process.exit(0)});"], { projectName, env }), "E2E application outbound isolation");

  const baseUrl = `http://localhost:${currentAppPort}`;
  if (!(await waitForHttp(`${baseUrl}/api/health`, { timeoutMs: 60_000 })).ok) throw new Error("E2E health endpoint did not return 200.");
  if (!(await waitForHttp(`${baseUrl}/api/ready`, { timeoutMs: 60_000 })).ok) throw new Error("E2E readiness endpoint did not return 200.");
  if (phase1Acceptance) runPhase1BrowserPlan(env);
  else {
    const projectsToRun = playwrightArgs.some((arg) => arg.startsWith("--project")) ? playwrightArgs : ["--project=chromium", "--project=mobile", "--project=keyboard", ...playwrightArgs];
    const result = spawnSync(process.execPath, [path.join("node_modules", "playwright", "cli.js"), "test", ...projectsToRun], { cwd: process.cwd(), env, stdio: "inherit", shell: false });
    if (result.status !== 0) throw new Error("Playwright E2E tests failed.");
  }
  safeLog("Disposable Playwright E2E tests passed.");
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
