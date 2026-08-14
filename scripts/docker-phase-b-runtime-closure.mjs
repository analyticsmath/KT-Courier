import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { getSchemaVerifierComposeArgs, sanitize } from "./docker-common.mjs";

const projectName = process.env.KT_PHASEB_RUNTIME_PROJECT_NAME || "kt-couriers-phaseb-runtime";
const composeFile = "compose.phase-b-runtime.yml";
const port = process.env.KT_PHASEB_POSTGRES_PORT || "55935";
const dbName = "kt_courier_phase_b_runtime_disposable";
const dbUser = "kt_courier_phase_b_runtime";
const dbPassword = "phase_b_runtime_local_only";

function fail(message) { throw new Error(message); }
function docker(args, env = process.env, stdio = "pipe") { return spawnSync("docker", args, { cwd: process.cwd(), env, encoding: "utf8", stdio, shell: false }); }
function assertSuccess(result, label) { if (result.status !== 0) fail(`${label} failed: ${sanitize(`${result.stdout || ""}\n${result.stderr || ""}`) || "command failed"}`); }
function compose(args, env) { return docker(["compose", "-p", projectName, "-f", composeFile, ...args], env); }
function assertDisposableIdentity() {
  if (!/^kt-couriers-(?:phaseb-runtime|ci-phaseb-runtime)(?:-[a-z0-9-]+)?$/.test(projectName)) fail(`Refusing non-disposable Phase B project '${projectName}'.`);
  if (projectName === "kt-couriers" || !/^kt_courier_phase_b_runtime_disposable$/.test(dbName)) fail("Refusing normal/shared project or database identity.");
  if (port === "5432" || port === "5433" || port === "55834") fail(`Refusing reserved/shared PostgreSQL port '${port}'.`);
  if (!existsSync(composeFile)) fail(`${composeFile} is missing.`);
}
function cleanup(env) {
  const result = compose(["down", "-v", "--remove-orphans", "--rmi", "local"], env);
  if (result.status !== 0) process.stderr.write(`${sanitize(result.stderr || result.stdout || "Phase B disposable cleanup failed.")}\n`);
}
function runNode(args, env) { return spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: "inherit", shell: false }); }

async function main() {
  assertDisposableIdentity();
  if (runNode(["scripts/source-schema-preflight.mjs", "--suite", "phase-b"], process.env).status !== 0) fail("Local source/schema preflight failed.");
  const env = { ...process.env, POSTGRES_DB: dbName, POSTGRES_USER: dbUser, POSTGRES_PASSWORD: dbPassword, POSTGRES_PORT: port };
  const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${port}/${dbName}?schema=public`;
  assertSuccess(docker(["info"]), "docker info");
  assertSuccess(compose(["config", "--quiet"], env), "Phase B runtime compose config");
  assertSuccess(compose(["build", "migrate"], env), "Phase B runtime migrator build");
  assertSuccess(compose(["up", "-d", "db"], env), "Phase B runtime database startup");
  assertSuccess(compose(["run", "--rm", "migrate"], env), "Phase B forward migration deploy");
  assertSuccess(compose(["run", "--rm", "migrate", "npx", "prisma", "migrate", "status"], env), "Phase B migration status");
  assertSuccess(compose(getSchemaVerifierComposeArgs(env), env), "Phase B schema drift verification");
  const testEnv = { ...env, DATABASE_URL: databaseUrl, KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true", KT_ALLOW_ISOLATED_POSTGRES_TESTS: "1", KT_PHASEB_RUNTIME_APPROVED: "1" };
  // Suites use production authorities and isolated fixtures where their release gate permits execution; no shared demo seed is permitted.
  if (runNode(["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.phase-b-runtime.config.ts"], testEnv).status !== 0) fail("Phase B PostgreSQL/concurrency proof suite failed.");
  console.log("PHASE_B_RUNTIME_CLOSURE_HARNESS=PASSED");
}

let failed = false;
try { await main(); } catch (error) { failed = true; process.stderr.write(`${sanitize(error instanceof Error ? error.message : String(error))}\n`); }
finally { const env = { ...process.env, POSTGRES_DB: dbName, POSTGRES_USER: dbUser, POSTGRES_PASSWORD: dbPassword, POSTGRES_PORT: port }; cleanup(env); }
process.exit(failed ? 1 : 0);
