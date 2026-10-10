// Only these guarded suites require an already migrated test database. Never
// accept a database URL from the caller; own the server, role and project.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { assertSuccess, runCompose, runDocker, safeError, startDisposableComposeWithPortRetry, waitForServiceHealth } from "./docker-common.mjs";

const command = process.argv[2];
if (!new Set(["test:integration:catalog", "test:integration:storefront", "test:integration:marketplace-checkout", "test:integration:store-orders", "test:integration:withdrawals", "test:integration:webhook-concurrency"]).has(command) || process.argv.length !== 3) throw new Error("Unsupported prepared database suite.");
const projectName = `kt-couriers-new-phase1-${Date.now()}-${process.pid}`;
const buildEnv = port => ({ ...process.env, NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1", KT_WITHDRAWAL_INTEGRATION_APPROVED: "true", POSTGRES_DB: "kt_launch_test", POSTGRES_USER: "kt_closure_test", POSTGRES_PASSWORD: "disposable_phase1_only", POSTGRES_PORT: String(port), DATABASE_URL: `postgresql://kt_closure_test:disposable_phase1_only@127.0.0.1:${port}/kt_launch_test?schema=public`, SHADOW_DATABASE_URL: `postgresql://kt_closure_test:disposable_phase1_only@127.0.0.1:${port}/kt_launch_test_shadow?schema=public` });
let env = buildEnv(5432);
try {
  assertSuccess(runDocker(["info"]), "Docker availability");
  env = (await startDisposableComposeWithPortRetry({ projectName, buildEnv })).env;
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 120000 }) !== "healthy") throw new Error("Disposable database unhealthy.");
  const identity = runCompose(["exec", "-T", "db", "psql", "-U", env.POSTGRES_USER, "-d", env.POSTGRES_DB, "-Atc", "SELECT current_database(), current_user"], { projectName, env });
  assertSuccess(identity, "Disposable identity query");
  if (identity.stdout.trim() !== "kt_launch_test|kt_closure_test") throw new Error("Disposable identity mismatch.");
  assertSuccess(spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, encoding: "utf8", shell: false }), "Disposable migration deploy");
  console.log(`[NEW_PHASE1_POSTGRES] ${projectName}; generated loopback database and role verified; no production source.`);
  const npm = process.platform === "win32" ? process.execPath : "npm";
  const args = [...(process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")] : []), "run", command];
  const result = spawnSync(npm, args, { env, shell: false, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} catch (error) { safeError(error instanceof Error ? error.message : "Isolated suite failed."); process.exitCode = 1; }
finally {
  if (!/^kt-couriers-new-phase1-\d+-\d+$/.test(projectName)) throw new Error("Refusing non-disposable cleanup.");
  if (runCompose(["down", "-v", "--remove-orphans"], { projectName, env }).status !== 0) { safeError("Disposable cleanup failed."); process.exitCode = 1; }
}
