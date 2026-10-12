import { spawnSync } from "node:child_process";
import path from "node:path";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import process from "node:process";
import { disposableBrowserOrigins } from "./e2e-environment.mjs";
import { runPhase1BrowserPlan } from "./phase1-browser-plan.mjs";
import { certificationEnvironmentProfile } from "./certification-output.mjs";
import { disposableProviderEnvironment, e2eImageNames, e2eStandaloneRuntimeDockerfile, isExactPhase2And3DirectedSelection, playwrightTimeoutMs } from "./e2e-runner-policy.mjs";
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
const e2eImages = e2eImageNames(nonce);
const usesHostStandaloneBuild = process.env.KT_E2E_USE_HOST_STANDALONE === "true";
const harnessStartedAt = Date.now();
const playwrightArgs = process.argv.slice(2);
const phase1Acceptance = playwrightArgs.includes("--phase1-catalog");
const phase2Canonical = playwrightArgs.includes("--phase2-canonical");
if (phase2Canonical && playwrightArgs.some(arg => !["--phase2-canonical", "--project=chromium"].includes(arg))) throw new Error("Canonical acceptance uses its fixed required selection.");
if (phase1Acceptance && playwrightArgs.some(arg => !["--phase1-catalog", "--project=chromium"].includes(arg))) throw new Error("Phase 1 acceptance uses its fixed required selections.");

function runCompose(args, options) {
  return runBaseCompose(args, { ...options, extraComposeFiles: ["compose.e2e.yml"] });
}

function buildEnv(port, appPort) {
  return {
    ...disposableProviderEnvironment(process.env),
    POSTGRES_DB: database,
    POSTGRES_USER: database,
    POSTGRES_PASSWORD: password,
    SHADOW_POSTGRES_DB: `${database}_shadow`,
    POSTGRES_PORT: String(port),
    APP_PORT: String(appPort),
    // Compose publishes IPv4 loopback only. On Windows, localhost's IPv6
    // connection fallback exceeds Prisma's transaction acquisition deadline.
    DATABASE_URL: `postgresql://${database}:${password}@127.0.0.1:${port}/${database}?schema=public`,
    SHADOW_DATABASE_URL: `postgresql://${database}:${password}@127.0.0.1:${port}/${database}_shadow?schema=public`,
    // Host-side fixtures do not need Redis; keep any inherited live URL out.
    // The application uses the owned Compose service in compose.e2e.yml.
    REDIS_URL: "redis://127.0.0.1:1/0",
    NEXT_PUBLIC_APP_URL: `http://localhost:${appPort}`,
    APP_URL: `http://localhost:${appPort}`,
    ALLOWED_ORIGINS: disposableBrowserOrigins(appPort),
    EMAIL_PROVIDER: "console",
    // Non-secret test configuration allows pre-payment browser commands. The
    // isolated network prevents provider access; no payment success is invented.
    PAYSTACK_MODE: "test",
    PAYMENT_APP_ORIGIN: `http://localhost:${appPort}`,
    KT_E2E_NETWORK_INTERNAL: "true",
    KT_E2E_PAYSTACK_ACCEPTANCE: "true",
    KT_LOCAL_FULL_FLOW: "false",
    NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    E2E_ROUTE_PROVIDER: "deterministic",
    KT_NETWORK_DISABLED: "true",
    KT_E2E_GEOCODE_FIXTURES: JSON.stringify({ "45 Commission St, Central, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2041, longitude: 28.0473 }, "10 E2E Pickup Road, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2041, longitude: 28.0473 }, "45 Commission St, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2051, longitude: 28.0483 } }),
    NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES: "true",
    // Every disposable run owns its own tags; never replace shared :latest tags.
    APP_IMAGE: e2eImages.appImage,
    MIGRATE_IMAGE: e2eImages.migrateImage,
    NODE_ENV: "test",
    KT_RUNTIME_ENV: "e2e",
    KT_E2E_RATE_LIMIT_MODE: "relaxed",
    KT_LOCAL_STOREFRONT_VALIDATION: "true",
    KT_LOCAL_CHECKOUT_VALIDATION: "true",
    PLAYWRIGHT_BASE_URL: `http://localhost:${appPort}`,
    E2E_BASE_URL: `http://localhost:${appPort}`,
  };
}

function prepareHostStandaloneImage() {
  const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
  const sourceTreeSha = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).stdout?.trim();
  const manifestPath = path.resolve(`output/production-closure/e2e-host-standalone-${sourceSha}.json`);
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { throw new Error("Exact-source host standalone build receipt is missing or invalid."); }
  if (manifest.status !== "PASS" || manifest.commitSha !== sourceSha || manifest.sourceTreeSha !== sourceTreeSha || manifest.hostBuildEnvironment !== "sanitized; workspace environment files and inherited provider credentials excluded") {
    throw new Error("Host standalone build receipt does not match the exact current source commit and tree.");
  }
  const standalone = path.resolve(".next", "standalone");
  const standaloneBuildId = readFileSync(path.join(standalone, ".next", "BUILD_ID"), "utf8").trim();
  if (!standaloneBuildId || standaloneBuildId !== manifest.buildId) throw new Error("Host standalone output does not match its recorded build ID.");
  const migrationImageId = runDocker(["image", "inspect", "--format", "{{.Id}}", e2eImages.migrateImage]);
  if (migrationImageId.status !== 0 || !/^sha256:[a-f0-9]{64}$/.test(migrationImageId.stdout.trim())) throw new Error("Run-scoped disposable migration image is missing.");

  const outputRoot = path.resolve("output", "production-closure");
  const contextDirectory = path.resolve(outputRoot, `e2e-host-runtime-context-${nonce}`);
  try {
    mkdirSync(contextDirectory, { recursive: false });
    cpSync(path.join(standalone, ".next"), path.join(contextDirectory, "standalone-next"), { recursive: true, errorOnExist: true });
    cpSync(path.join(standalone, "server.js"), path.join(contextDirectory, "standalone-server.js"));
    cpSync(path.resolve(".next", "static"), path.join(contextDirectory, "static"), { recursive: true, errorOnExist: true });
    cpSync(path.resolve("public"), path.join(contextDirectory, "public"), { recursive: true, errorOnExist: true });
    cpSync(path.resolve("var", "catalog-media"), path.join(contextDirectory, "catalog-media"), { recursive: true, errorOnExist: true });
    cpSync(path.resolve("docs", "client-authority", "2026-10"), path.join(contextDirectory, "client-authority"), { recursive: true, errorOnExist: true });
    writeFileSync(path.join(contextDirectory, "Dockerfile"), e2eStandaloneRuntimeDockerfile(e2eImages.migrateImage, sourceSha));
    assertSuccess(runDocker(["build", "--tag", e2eImages.appImage, "--file", path.join(contextDirectory, "Dockerfile"), contextDirectory], { timeout: 600_000 }), "E2E host standalone runtime image build");
    const labels = runDocker(["image", "inspect", "--format", "{{ index .Config.Labels \"org.ktcouriers.e2e.source-sha\" }}|{{ index .Config.Labels \"org.ktcouriers.e2e.linux-prisma-image\" }}", e2eImages.appImage]);
    if (labels.status !== 0 || labels.stdout.trim() !== `${sourceSha}|${e2eImages.migrateImage}`) {
      throw new Error("Host standalone runtime image did not retain its source and disposable Linux Prisma labels.");
    }
  } finally {
    const resolvedOutput = path.resolve(outputRoot);
    const resolvedContext = path.resolve(contextDirectory);
    if (resolvedContext.startsWith(`${resolvedOutput}${path.sep}`) && existsSync(resolvedContext)) rmSync(resolvedContext, { recursive: true, force: true });
  }
}

function inspectImageId(image) {
  const result = runDocker(["image", "inspect", "--format", "{{.Id}}", image]);
  return result.status === 0 && /^sha256:[a-f0-9]{64}$/.test(result.stdout.trim()) ? result.stdout.trim() : null;
}

function writePlaywrightReceipt(args, timeoutMs, result, startedAtMs, runtimeEnv) {
  const endedAtMs = Date.now();
  const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim() ?? null;
  const sourceTreeSha = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).stdout?.trim() ?? null;
  const receiptPath = path.resolve(`output/production-closure/e2e-runtime-${nonce}.json`);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, JSON.stringify({
    schemaVersion: 1,
    command: [process.execPath, path.join("node_modules", "playwright", "cli.js"), "test", ...args],
    selection: isExactPhase2And3DirectedSelection(args) ? "phase2-3-directed" : phase1Acceptance ? "phase1-seven-stage-plan" : phase2Canonical ? "phase2-canonical-postgres" : "custom-e2e",
    commitSha: sourceSha,
    sourceTreeSha,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    timeoutMs,
    expectedTests: isExactPhase2And3DirectedSelection(args) ? 43 : phase1Acceptance ? null : phase2Canonical ? 41 : null,
    expectedTestCountSource: phase1Acceptance ? "dynamic discovery and per-stage counts in phase1-browser-stages.json" : "fixed selection or custom runner report",
    process: { exitCode: result.status, signal: result.signal ?? null, errorCode: result.error?.code ?? null },
    environment: {
      profile: certificationEnvironmentProfile(runtimeEnv, "test:e2e"),
      composeProject: projectName,
      databaseName: database,
      databaseIngress: "127.0.0.1 ephemeral port",
      browserIngress: "127.0.0.1 ephemeral port",
      applicationNetwork: "internal-only",
      applicationEgressProbe: "literal 1.1.1.1:443 blocked before browser execution",
      redis: "disposable Compose service",
      paystack: "test-mode dummy fixture only; no external provider access",
      emailProvider: "console",
      networkDisabled: true,
      appImage: e2eImages.appImage,
      appImageId: inspectImageId(e2eImages.appImage),
      appImageBuildMode: usesHostStandaloneBuild ? "host-next-standalone-with-disposable-linux-runtime" : "docker-production-build",
      migrateImage: e2eImages.migrateImage,
      migrateImageId: inspectImageId(e2eImages.migrateImage),
    },
    status: result.status === 0 ? "PASS" : result.error?.code === "ETIMEDOUT" ? "TIMEOUT_INCOMPLETE" : "FAIL",
  }, null, 2));
  return receiptPath;
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
  if (result.status !== 0) {
    safeError(result.stderr || result.stdout || "E2E cleanup failed.");
    return false;
  }
  return true;
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
    if (usesHostStandaloneBuild) {
      prepareHostStandaloneImage();
    } else {
      assertSuccess(runCompose(["build", "app"], { projectName, env }), "E2E application build");
    }

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
let cleanupFailed = false;
try {
  assertDisposableProject();
  assertSuccess(runDocker(["info"]), "docker info");
  await startE2EServicesWithRetry(3);

  // Prove provider isolation before any browser can submit a payment command.
  // A literal public address avoids treating a DNS outage as isolation proof.
  assertSuccess(runCompose(["exec", "-T", "app", "node", "-e", "process.exit(process.env.REDIS_URL==='redis://redis:6379/0'?0:1)"], { projectName, env }), "E2E application owned Redis binding");
  assertSuccess(runCompose(["exec", "-T", "app", "node", "-e", "const net=require('node:net'); const s=net.connect({host:'1.1.1.1',port:443}); s.setTimeout(3000); s.once('connect',()=>{s.destroy();process.exit(1)}); s.once('error',()=>process.exit(0)); s.once('timeout',()=>{s.destroy();process.exit(0)});"], { projectName, env }), "E2E application outbound isolation");

  const baseUrl = `http://localhost:${currentAppPort}`;
  if (!(await waitForHttp(`${baseUrl}/api/health`, { timeoutMs: 60_000 })).ok) throw new Error("E2E health endpoint did not return 200.");
  if (!(await waitForHttp(`${baseUrl}/api/ready`, { timeoutMs: 60_000 })).ok) throw new Error("E2E readiness endpoint did not return 200.");
  if (phase2Canonical) {
    const report = path.resolve("output/production-closure/phase2-canonical-vitest.json");
    mkdirSync(path.dirname(report), { recursive: true });
    // Forty-one mandatory canonical cases include three additional paid
    // replacement price/expiry boundaries; keep execution finite at 20 minutes.
    const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config=vitest.phase2-canonical-acceptance.config.ts", "--reporter=default", "--reporter=json", `--outputFile.json=${report}`], { cwd: process.cwd(), env, stdio: "inherit", shell: false, timeout: 1_200_000 });
    const counts = JSON.parse(readFileSync(report, "utf8"));
    if (result.status !== 0 || counts.numTotalTests !== 41 || counts.numPassedTests !== 41 || counts.numFailedTests || counts.numPendingTests || counts.numTodoTests) throw new Error("All forty-one canonical marketplace/store/refund/driver/COD PostgreSQL cases must execute and pass without deferrals.");
  } else if (phase1Acceptance) runPhase1BrowserPlan(env);
  else {
    if (playwrightArgs.includes("tests/e2e/marketplace-checkout-payment.spec.ts")) {
      mkdirSync("output/production-closure", { recursive: true });
      const probe = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase2-paystack-control.ts", "__probe__", "probe"], { cwd: process.cwd(), env, stdio: "inherit", shell: false, timeout: 20_000 });
      if (probe.status !== 0) throw new Error("Disposable PostgreSQL financial acceptance preflight failed.");
      const report = path.resolve("output/production-closure/paystack-postgres-vitest.json");
      const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
      const started = Date.now();
      const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config=vitest.paystack-acceptance.config.ts", "--reporter=default", "--reporter=json", `--outputFile.json=${report}`], { cwd: process.cwd(), env, stdio: "inherit", shell: false, timeout: 120_000 });
      let counts;
      try { counts = JSON.parse(readFileSync(report, "utf8")); } catch { /* Missing evidence refuses acceptance. */ }
      const passed = /^[a-f0-9]{40}$/.test(sha ?? "") && result.status === 0 && counts?.numPassedTests === 2 && counts?.numFailedTests === 0 && counts?.numPendingTests === 0 && counts?.numTodoTests === 0;
      writeFileSync("output/production-closure/paystack-postgres-receipt.json", JSON.stringify({ commitSha: sha, durationMs: Date.now() - started, exitCode: result.status, testsPassed: counts?.numPassedTests ?? null, testsFailed: counts?.numFailedTests ?? null, testsSkipped: counts?.numPendingTests ?? null, testsTodo: counts?.numTodoTests ?? null, status: passed ? "PASS" : "FAIL", database, projectName }, null, 2));
      if (!passed) throw new Error("Canonical Paystack PostgreSQL acceptance failed; browser cases were not started.");
    }
    const projectsToRun = playwrightArgs.some((arg) => arg.startsWith("--project")) ? playwrightArgs : ["--project=chromium", "--project=mobile", "--project=keyboard", ...playwrightArgs];
    const timeout = playwrightTimeoutMs(projectsToRun);
    const selectionStartedAt = Date.now();
    const result = spawnSync(process.execPath, [path.join("node_modules", "playwright", "cli.js"), "test", ...projectsToRun], { cwd: process.cwd(), env, stdio: "inherit", shell: false, timeout });
    const receiptPath = writePlaywrightReceipt(projectsToRun, timeout, result, selectionStartedAt, env);
    safeLog(`E2E_SELECTION_RECEIPT=${receiptPath}`);
    if (result.error?.code === "ETIMEDOUT") safeError(`Playwright process timed out after ${timeout}ms; the stage is incomplete.`);
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
  cleanupFailed = !(await cleanup());
  if (cleanupFailed) failed = true;
}

const harnessEndedAt = Date.now();
const harnessSourceSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim() ?? null;
const harnessSourceTreeSha = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).stdout?.trim() ?? null;
const harnessReceiptPath = path.resolve(`output/production-closure/e2e-harness-${nonce}.json`);
mkdirSync(path.dirname(harnessReceiptPath), { recursive: true });
let fullChromiumExpectedTests = null;
if (phase1Acceptance) {
  try { fullChromiumExpectedTests = JSON.parse(readFileSync("output/production-closure/phase1-browser-stages.json", "utf8")).find(stage => stage.stage === "full-chromium")?.expectedTests ?? null; } catch { /* Incomplete discovery is not an invented count. */ }
}
writeFileSync(harnessReceiptPath, JSON.stringify({
  schemaVersion: 1,
  command: [process.execPath, "scripts/e2e-test.mjs", ...playwrightArgs],
  selection: phase1Acceptance ? "phase1-seven-stage-plan" : phase2Canonical ? "phase2-canonical-postgres" : isExactPhase2And3DirectedSelection(playwrightArgs) ? "phase2-3-directed" : "custom-e2e",
  commitSha: harnessSourceSha,
  sourceTreeSha: harnessSourceTreeSha,
  startedAt: new Date(harnessStartedAt).toISOString(),
  endedAt: new Date(harnessEndedAt).toISOString(),
  durationMs: harnessEndedAt - harnessStartedAt,
  expectedTests: phase1Acceptance ? fullChromiumExpectedTests : phase2Canonical ? 41 : isExactPhase2And3DirectedSelection(playwrightArgs) ? 43 : null,
  process: { exitCode: failed ? 1 : 0 },
  cleanup: cleanupFailed ? "FAIL" : "PASS",
  environment: {
    profile: certificationEnvironmentProfile(env, "test:e2e"),
    composeProject: projectName,
    databaseName: database,
    databaseIngress: "127.0.0.1 ephemeral port",
    browserIngress: "127.0.0.1 ephemeral port",
    applicationNetwork: "internal-only",
    applicationEgressProbe: "literal 1.1.1.1:443 blocked before browser execution",
    redis: "disposable Compose service",
    paystack: "test-mode dummy fixture only; no external provider access",
    emailProvider: "console",
    networkDisabled: true,
    appImage: e2eImages.appImage,
    appImageId: inspectImageId(e2eImages.appImage),
    appImageBuildMode: usesHostStandaloneBuild ? "host-next-standalone-with-disposable-linux-runtime" : "docker-production-build",
    migrateImage: e2eImages.migrateImage,
    migrateImageId: inspectImageId(e2eImages.migrateImage),
  },
  stageReportPath: phase1Acceptance ? path.resolve("output/production-closure/phase1-browser-stages.json") : phase2Canonical ? path.resolve("output/production-closure/phase2-canonical-vitest.json") : null,
  status: failed ? "FAIL" : "PASS",
}, null, 2));
safeLog(`E2E_HARNESS_RECEIPT=${harnessReceiptPath}`);
process.exit(failed ? 1 : 0);
