import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-phase10-payment-disposable-${nonce}`;
const database = `kt_phase10_payment_${process.pid}`;
const port = String(58700 + (process.pid % 600));
const password = "phase10_payment_disposable_only";
const env = { ...process.env, POSTGRES_DB: database, POSTGRES_USER: database, POSTGRES_PASSWORD: password, POSTGRES_PORT: port, DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`, SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`, EMAIL_PROVIDER: "console" };
function assertDisposable() { if (projectName === normalComposeProject || !/^kt-couriers-phase10-payment-disposable-/.test(projectName)) throw new Error("Refusing to operate a non-disposable Compose project."); }
const compose = (args) => runCompose(args, { projectName, env });
const localNode = (args) => spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: "inherit", shell: false });
let failed = false;
try {
  assertDisposable();
  if (runDocker(["info"]).status !== 0) throw new Error("Docker is unavailable.");
  if (compose(["up", "-d", "db"]).status !== 0) throw new Error("Disposable database startup failed.");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") throw new Error("Disposable database did not become healthy.");
  if (compose(["run", "--build", "--rm", "migrate"]).status !== 0) throw new Error("Migration deployment failed.");
  if (compose(["run", "--build", "--rm", "seed"]).status !== 0) throw new Error("First seed run failed.");
  if (compose(["run", "--build", "--rm", "seed"]).status !== 0) throw new Error("Second seed run failed.");
  if (localNode([path.join("scripts", "phase10-payment-preflight.mjs")]).status !== 0) throw new Error("Payment preflight failed.");
  if (localNode([path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.payment-foundation-integration.config.ts"]).status !== 0) throw new Error("Payment integration tests failed.");
  if (localNode([path.join("scripts", "verify-payment-invariants.mjs")]).status !== 0) throw new Error("Payment invariant verification failed.");
} catch (error) { failed = true; safeError(error instanceof Error ? error.message : String(error)); }
finally { assertDisposable(); if (compose(["down", "-v", "--remove-orphans"]).status !== 0) safeError("Disposable Phase 10 cleanup failed."); }
safeLog(failed ? "Phase 10 payment integration suite failed." : "Phase 10 payment integration suite passed.");
process.exit(failed ? 1 : 0);

