import { spawn } from "node:child_process";
// This coordinator invokes only the canonical service worker. It never writes
// assignment, delivery, balance, earning, or ledger records directly.
const child = spawn("npx", ["tsx", "scripts/release-mature-driver-earnings-worker.ts"], { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
