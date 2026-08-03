import { spawn } from "node:child_process";

// The worker invokes only the canonical internal release service. That service
// owns eligibility, account locking, journal posting and the source-level lock.
const child = spawn("npx", ["tsx", "scripts/release-mature-store-earnings-worker.ts"], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
