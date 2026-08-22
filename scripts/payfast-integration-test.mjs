import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-phase11-payfast-disposable-${nonce}`;
const database = `kt_phase11_payfast_${process.pid}`;
const port = String(59300 + (process.pid % 500));
const password = "phase11_payfast_disposable_only";
const env = {
  ...process.env,
  POSTGRES_DB: database, POSTGRES_USER: database, POSTGRES_PASSWORD: password, POSTGRES_PORT: port,
  DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
  SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
  PAYFAST_MODE: "sandbox", PAYFAST_MERCHANT_ID: "integration-merchant-id", PAYFAST_MERCHANT_KEY: "integration-merchant-key",
  PAYFAST_PASSPHRASE: "integration-private-passphrase", PAYMENT_APP_ORIGIN: "https://payfast-integration.example.test", EMAIL_PROVIDER: "console",
  KT_ALLOW_DEMO_SEED: "true",
};
function assertDisposable() { if (projectName === normalComposeProject || !/^kt-couriers-phase11-payfast-disposable-/.test(projectName)) throw new Error("Refusing to operate a non-disposable Compose project."); }
const compose = (args) => runCompose(args, { projectName, env });
const localNode = (args) => spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: "inherit", shell: false });
let failed = false;
try {
  assertDisposable();
  if (runDocker(["info"]).status !== 0) throw new Error("Docker is unavailable.");
  if (compose(["up", "-d", "db"]).status !== 0) throw new Error("Disposable database startup failed.");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 }) !== "healthy") throw new Error("Disposable database did not become healthy.");
  if (compose(["run", "--build", "--rm", "migrate"]).status !== 0) throw new Error("Migration deployment failed.");
  if (compose(["run", "--build", "--rm", "seed"]).status !== 0) throw new Error("Seed failed.");
  if (localNode([path.join("scripts", "phase11-payfast-preflight.mjs")]).status !== 0) throw new Error("Payfast preflight failed.");
  if (localNode([path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.payfast-integration.config.ts"]).status !== 0) throw new Error("Payfast integration tests failed.");
  if (localNode([path.join("scripts", "verify-payfast-invariants.mjs")]).status !== 0) throw new Error("Payfast invariant verification failed.");
} catch (error) { failed = true; safeError(error instanceof Error ? error.message : String(error)); }
finally { assertDisposable(); if (compose(["down", "-v", "--remove-orphans"]).status !== 0) safeError("Disposable Phase 11 cleanup failed."); }
safeLog(failed ? "Phase 11 Payfast integration suite failed." : "Phase 11 Payfast integration suite passed.");
process.exit(failed ? 1 : 0);
