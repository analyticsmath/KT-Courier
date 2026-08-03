// Deliberately unexecuted Phase 13 PostgreSQL integration scaffold.
// A later consolidated validation gate must supply an isolated disposable Compose project,
// apply migrations, seed deterministic finance fixtures, run this config, and remove only
// its uniquely named disposable project resources.
import { spawn } from "node:child_process";

if (process.env.KT_WITHDRAWAL_INTEGRATION_APPROVED !== "true") {
  console.error("Withdrawal integration tests are deferred until the consolidated validation gate approves an isolated PostgreSQL run.");
  process.exitCode = 1;
} else {
  const child = spawn("npx", ["vitest", "run", "--config", "vitest.withdrawal-integration.config.ts"], { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
