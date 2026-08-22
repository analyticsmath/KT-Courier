import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { normalComposeProject, runCompose, runDocker, safeError, safeLog, waitForServiceHealth } from "./docker-common.mjs";

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-phase12-payfast-confirmation-disposable-${nonce}`;
const database = `kt_phase12_payfast_${process.pid}`;
const port = String(59600 + (process.pid % 300));
const password = "phase12_payfast_disposable_only";
const env = { ...process.env, POSTGRES_DB: database, POSTGRES_USER: database, POSTGRES_PASSWORD: password, POSTGRES_PORT: port, DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`, SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`, PAYFAST_MODE: "sandbox", PAYFAST_MERCHANT_ID: "integration-merchant-id", PAYFAST_MERCHANT_KEY: "integration-merchant-key", PAYFAST_PASSPHRASE: "integration-private-passphrase", PAYFAST_CREDENTIAL_VERSION: "integration-sandbox-v1", PAYMENT_PROXY_MODE: "single_trusted_proxy", PAYMENT_APP_ORIGIN: "https://payfast-confirmation.example.test", KT_PAYFAST_TEST_DEPENDENCIES: "deterministic-injected", EMAIL_PROVIDER: "console", KT_ALLOW_DEMO_SEED: "true" };
function assertDisposable() { if (projectName === normalComposeProject || !/^kt-couriers-phase12-payfast-confirmation-disposable-/.test(projectName)) throw new Error("Refusing to operate a non-disposable Compose project."); }
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
  if (localNode([path.join("scripts", "phase12-payfast-itn-preflight.mjs")]).status !== 0) throw new Error("Phase 12 preflight failed.");
  if (localNode([path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.payfast-confirmation-integration.config.ts"]).status !== 0) throw new Error("Phase 12 integration tests failed.");
  if (localNode([path.join("scripts", "verify-payment-confirmation-invariants.mjs")]).status !== 0) throw new Error("Phase 12 invariants failed.");
} catch (error) { failed = true; safeError(error instanceof Error ? error.message : String(error)); }
finally { assertDisposable(); if (compose(["down", "-v", "--remove-orphans"]).status !== 0) safeError("Disposable Phase 12 cleanup failed."); }
safeLog(failed ? "Phase 12 Payfast confirmation integration suite failed." : "Phase 12 Payfast confirmation integration suite passed.");
process.exit(failed ? 1 : 0);
