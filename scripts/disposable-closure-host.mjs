import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { assertSuccess, findAvailableLoopbackPort, runCompose, waitForServiceHealth } from "./docker-common.mjs";

// Use host dependencies if the migrator image cannot be built. Always create a
// dedicated Compose project and loopback database; never use inherited URLs.
const projectName = `kt-couriers-closure-host-${Date.now()}-${process.pid}`;
const port = await findAvailableLoopbackPort();
const databaseUrl = `postgresql://kt_closure_test:disposable_closure_only@127.0.0.1:${port}/kt_launch_test?schema=public`;
const env = {
  ...process.env,
  NODE_ENV: "test",
  KT_RUNTIME_ENV: "e2e",
  KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1",
  KT_NETWORK_DISABLED: "true",
  EMAIL_PROVIDER: "console",
  PAYSTACK_ACTIVE: "false",
  POSTGRES_DB: "kt_launch_test",
  POSTGRES_USER: "kt_closure_test",
  POSTGRES_PASSWORD: "disposable_closure_only",
  POSTGRES_PORT: String(port),
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  SHADOW_DATABASE_URL: `postgresql://kt_closure_test:disposable_closure_only@127.0.0.1:${port}/kt_launch_test_shadow?schema=public`,
  KT_DATABASE_CLASSIFICATION: "development",
};

// Reuse the canonical closure suite instead of maintaining a divergent list.
const source = readFileSync("scripts/disposable-closure-tests.mjs", "utf8").split("const selection =")[0];
const files = [...new Set([...source.matchAll(/"(tests\/[^\"]+\.test\.ts)"/g)].map(match => match[1]))];
let exitCode = 1;
try {
  if (!files.length) throw new Error("No closure integration tests were discovered.");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env }), "Disposable database startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 120000 }) !== "healthy") {
    throw new Error("Disposable database is unhealthy.");
  }
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
  if (migration.status !== 0) throw new Error("Host migration failed.");

  mkdirSync("output/production-closure", { recursive: true });
  const report = "output/production-closure/postgres-host.json";
  const tests = spawnSync(process.execPath, [
    "node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts", ...files,
    "--maxWorkers=1", "--no-file-parallelism", "--reporter=default", "--reporter=json", `--outputFile.json=${report}`,
  ], { env, stdio: "inherit" });
  if (tests.status !== 0) throw new Error("PostgreSQL tests failed.");
  const summary = JSON.parse(readFileSync(report, "utf8"));
  if (!summary.numTotalTests || summary.numPendingTests || summary.numTodoTests ||
      summary.testResults.some(suite => suite.assertionResults.some(test => ["pending", "todo", "skipped", "disabled"].includes(test.status)))) {
    throw new Error("Release-critical tests were skipped or not discovered.");
  }
  console.log(`HOST_CLOSURE_PASSED files=${files.length} tests=${summary.numPassedTests} skipped=0`);
  exitCode = 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Host closure failed.");
} finally {
  const cleanup = runCompose(["down", "-v", "--remove-orphans"], { projectName, env, timeout: 60000 });
  if (cleanup.status !== 0) {
    console.error("Disposable cleanup failed.");
    exitCode = 1;
  }
}
process.exitCode = exitCode;
