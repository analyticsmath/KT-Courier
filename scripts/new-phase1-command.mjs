// Record actual command output and source identity without inheriting live
// integration credentials. Database tests still use their existing disposable
// runners; the fallback loopback URL cannot reach any database.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sanitize } from "./docker-common.mjs";
import { certificationTestCounts } from "./certification-output.mjs";

const [command, ...args] = process.argv.slice(2);
const allowed = new Set(["ci", "generate", "validate", "audit", "lint", "typecheck", "build", "migrations:check", "test:coverage", "test:paystack:contract", "test:paystack:invariants", "test:payments", "test:refunds", "test:security:bola", "test:processors", "test:integration:closure", "test:integration:catalog", "test:integration:marketplace-checkout", "test:integration:store-orders", "test:integration:refunds", "test:integration:withdrawals", "test:integration:ledger", "test:integration:driver-earnings", "test:integration:store-earnings", "test:integration:redis-rate-limit", "test:integration:bola-authority", "test:integration:migration-upgrade", "recovery:drill", "test:integration:auth", "test:integration:permissions", "test:integration:orders", "test:integration:pricing", "test:integration:dispatch", "test:integration:cross-module", "test:integration:driver-operations", "test:integration:payment-foundation", "test:integration:storefront", "docker:migration-smoke", "docker:gate4", "test:e2e"]);
allowed.add("test:integration:webhook-concurrency");
if (!allowed.has(command)) throw new Error("Unsupported isolated verification command.");
if (args.some(value => !/^[A-Za-z0-9_./=:-]+$/.test(value))) throw new Error("Unsupported command argument.");
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/SECRET|TOKEN|PASSWORD|DATABASE|REDIS|PAYSTACK|PAYFAST|RESEND|CLOUDINARY|SMTP|GOOGLE_MAPS|RAILWAY|SENTRY|EMAIL_PROVIDER|NOTIFICATION_SECURITY|^KT_|^APP_URL$|^ALLOWED_ORIGINS$|^NEXT_PUBLIC_|^NODE_OPTIONS$/.test(key)) delete env[key];
}
Object.assign(env, { NODE_ENV: "test", KT_NETWORK_DISABLED: "true", PAYSTACK_ACTIVE: "false", PAYSTACK_MODE: "disabled", EMAIL_PROVIDER: "console", NEXT_PUBLIC_APP_URL: "http://localhost:3000", APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://offline:offline_disposable_only@127.0.0.1:1/kt_offline_unreachable?schema=public", SHADOW_DATABASE_URL: "postgresql://offline:offline_disposable_only@127.0.0.1:1/kt_offline_unreachable_shadow?schema=public", KT_DATABASE_CLASSIFICATION: "development", NEXT_TELEMETRY_DISABLED: "1" });
// Next build uses production semantics without granting production authority.
if (command === "build") env.NODE_ENV = "production";
for (const [suite, flag] of [["refunds", "REFUND"], ["store-earnings", "STORE_EARNING"], ["driver-earnings", "DRIVER_EARNING"]]) {
  if (command === `test:integration:${suite}`) env[`KT_${flag}_INTEGRATION_APPROVED`] = "true";
}
const sourceSha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const dirty = spawnSync("git", ["diff", "HEAD", "--quiet"], {}).status !== 0;
const startedAt = new Date().toISOString();
const target = `output/production-closure/new-phase1/${command.replaceAll(":", "-")}-${Date.now()}`;
mkdirSync("output/production-closure/new-phase1", { recursive: true });
const npmArgs = command === "ci" ? ["ci"] : command === "generate" || command === "validate" ? ["exec", "--", "prisma", command] : command === "audit" ? ["audit", "--omit=dev", "--audit-level=high"] : ["run", command, ...(args.length ? ["--", ...args] : [])];
const prepared = new Set(["test:integration:catalog", "test:integration:storefront", "test:integration:marketplace-checkout", "test:integration:store-orders", "test:integration:withdrawals", "test:integration:webhook-concurrency"]).has(command);
if (prepared && args.length) throw new Error("Prepared suites use their complete required selection.");
const executable = prepared || process.platform === "win32" ? process.execPath : "npm";
const executableArgs = prepared ? ["scripts/new-phase1-prepared-postgres.mjs", command] : process.platform === "win32" ? [path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), ...npmArgs] : npmArgs;
const child = spawn(executable, executableArgs, { env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { const safe = sanitize(data.toString()); output += safe; writeFileSync(`${target}.log`, output); });
child.on("error", error => { output += sanitize(error.message); });
child.on("close", exitCode => {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const sourceShaEnd = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const dirtyEnd = spawnSync("git", ["diff", "HEAD", "--quiet"], {}).status !== 0;
  const receipt = { command: `npm ${npmArgs.join(" ")}`, sourceSha, dirty, sourceShaEnd, dirtyEnd, exactCommittedSource: !dirty && !dirtyEnd && sourceSha === sourceShaEnd, environment: "OFFLINE_OR_GENERATED_DISPOSABLE", startedAt, endedAt: new Date().toISOString(), exitCode, ...certificationTestCounts(plain), log: `${target}.log` };
  writeFileSync(`${target}.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
  console.log(plain.slice(-1800));
  process.exitCode = exitCode ?? 1;
});
