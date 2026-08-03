// Deliberately unexecuted Phase 14 PostgreSQL integration scaffold.
// Consolidated validation must provide an isolated disposable database before
// this command can run its plan, overlap, accrual, reversal, and rollback cases.
import { spawn } from "node:child_process";
if (process.env.KT_COMMISSION_INTEGRATION_APPROVED !== "true") { console.error("Commission integration tests are deferred until consolidated validation approves an isolated PostgreSQL run."); process.exitCode = 1; }
else { const child = spawn("npx", ["vitest", "run", "--config", "vitest.commission-integration.config.ts"], { stdio: "inherit", shell: process.platform === "win32" }); child.on("exit", (code) => { process.exitCode = code ?? 1; }); }
