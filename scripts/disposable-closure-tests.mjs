import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { assertSuccess, findAvailableLoopbackPort, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";
const projectName = `kt-couriers-closure-${Date.now()}-${process.pid}`;
const port = await findAvailableLoopbackPort();
const env = { ...process.env, NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1", KT_NETWORK_DISABLED: "true", EMAIL_PROVIDER: "console", PAYSTACK_ACTIVE: "false", POSTGRES_DB: "kt_launch_test", POSTGRES_USER: "kt_closure_test", POSTGRES_PASSWORD: "disposable_closure_only", POSTGRES_PORT: String(port), DATABASE_URL: `postgresql://kt_closure_test:disposable_closure_only@127.0.0.1:${port}/kt_launch_test?schema=public`, SHADOW_DATABASE_URL: `postgresql://kt_closure_test:disposable_closure_only@127.0.0.1:${port}/kt_launch_test_shadow?schema=public`, KT_DATABASE_CLASSIFICATION: "development" };
const files = ["tests/integration/driver-profile-atomicity.integration.test.ts", "tests/integration/commission-system.integration.test.ts", "tests/integration/production-closure.integration.test.ts", "tests/integration/customer-order-notifications.integration.test.ts", "tests/integration/required-domain-notifications.integration.test.ts", "tests/integration/guest-contact-verification.integration.test.ts", "tests/integration/checkout-legal-evidence.integration.test.ts", "tests/integration/dashboard-addresses.integration.test.ts", "tests/integration/email-delivery-recovery.integration.test.ts", "tests/integration/security-notification-outbox.integration.test.ts", "tests/integration/paystack-webhook-concurrency.integration.test.ts"];
files.push("tests/phase-b/private-media-vehicle-postgres.test.ts");
files.push("tests/integration/checkout-owner-resume.integration.test.ts");
files.push("tests/integration/storefront-editorial-atomicity.integration.test.ts");
files.push("tests/integration/driver-earning-canonical-postgres.integration.test.ts");
files.push("tests/integration/store-earning-canonical-postgres.integration.test.ts");
files.push("tests/integration/owner-withdrawal-canonical-postgres.integration.test.ts");
files.push("tests/integration/catalog-listing-draft-postgres.integration.test.ts");
files.push("tests/integration/business-employee-postgres.integration.test.ts");
files.push("tests/integration/catalog-permission-bootstrap-postgres.integration.test.ts");
let failed = false; let started = false;
try {
  // The database URL is constructed here; a supplied production URL is never used.
  assertSuccess(runDocker(["info"], { timeout: 20000 }), "Docker availability");
  started = true;
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "Disposable database startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 120000 }) !== "healthy") throw new Error("Disposable database unhealthy.");
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "Disposable migrations");
  mkdirSync("output/production-closure", { recursive: true });
  const report = "output/production-closure/postgres.json";
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts", ...files, "--reporter=default", "--reporter=json", `--outputFile.json=${report}`], { env, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Closure PostgreSQL tests failed.");
  const summary = JSON.parse(readFileSync(report, "utf8"));
  if (!summary.numTotalTests || summary.numPendingTests || summary.numTodoTests || summary.testResults.some((suite) => suite.assertionResults.some((test) => ["pending", "todo", "skipped", "disabled"].includes(test.status)))) throw new Error("Release-critical tests were skipped or not discovered.");
  safeLog(`Closure PostgreSQL proof: ${summary.numPassedTests} passed; zero skipped.`);
} catch (error) { failed = true; safeError(error instanceof Error ? error.message : "Closure integration failed."); }
finally { if (started) { const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env, timeout: 30000 }); if (result.status !== 0) { failed = true; safeError("Disposable cleanup failed."); } } }
process.exitCode = failed ? 1 : 0;
