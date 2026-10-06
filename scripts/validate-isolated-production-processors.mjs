import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Never pass production credentials into tests. PostgreSQL and Redis exist only
// on loopback in this disposable pre-deploy container, with no mounted volume.
const root = await mkdtemp(join(tmpdir(), "kt-launch-validation-"));
const pg = "/usr/lib/postgresql/15/bin";
const env = { PATH: process.env.PATH, NODE_ENV: "test", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: "postgresql://node@127.0.0.1:55432/kt_launch_test?schema=public", REDIS_URL: "redis://127.0.0.1:56379", KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1", STRICT_REDIS_INTEGRATION: "1", KT_ALLOW_REDIS_INTEGRATION_TESTS: "1", KT_DATABASE_CLASSIFICATION: "TEST", NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { env, stdio: "inherit", timeout: 900_000, ...extra });
  if (result.status !== 0) throw new Error(`Isolated validation failed: ${command.split("/").pop()}`);
}
let started = false;
try {
  run(`${pg}/initdb`, ["-D", join(root, "pg"), "--auth=trust", "--no-locale", "--encoding=UTF8"]);
  run(`${pg}/pg_ctl`, ["-D", join(root, "pg"), "-l", join(root, "postgres.log"), "-o", `-p 55432 -h 127.0.0.1 -k ${root}`, "-w", "start"]);
  started = true;
  run(`${pg}/createdb`, ["-h", "127.0.0.1", "-p", "55432", "kt_launch_test"]);
  run("redis-server", ["--bind", "127.0.0.1", "--port", "56379", "--daemonize", "yes", "--dir", root, "--save", "", "--appendonly", "no", "--pidfile", join(root, "redis.pid")]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts", "tests/integration/paystack-webhook-concurrency.integration.test.ts", "tests/integration/ledger-immutability.integration.test.ts", "tests/integration/reviewed-client-initialization.integration.test.ts", "--reporter=default", "--reporter=json", "--outputFile", join(root, "postgres-results.json")]);
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.redis-validation.config.ts", "--reporter=default", "--reporter=json", "--outputFile", join(root, "redis-results.json")]);
  const reports = await Promise.all(["postgres", "redis"].map(async (name) => ({ name, report: JSON.parse(await readFile(join(root, `${name}-results.json`), "utf8")) })));
  for (const { name, report } of reports) {
    if (!report.success || report.numFailedTests || report.numPendingTests || report.numTotalTests < 1) throw new Error("Validation must pass without skipped tests.");
    console.log(JSON.stringify({ event: "isolated_launch_validation", suite: name, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests }));
  }
} finally {
  spawnSync("redis-cli", ["-h", "127.0.0.1", "-p", "56379", "shutdown", "nosave"], { env, stdio: "ignore" });
  if (started) spawnSync(`${pg}/pg_ctl`, ["-D", join(root, "pg"), "-m", "immediate", "stop"], { env, stdio: "ignore" });
  await rm(root, { recursive: true, force: true });
}
