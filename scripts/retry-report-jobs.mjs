import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./generate-report-jobs.mjs", import.meta.url));
const result = spawnSync(process.execPath, [runner, "--retry-failed", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
if (result.error) {
  console.error("Could not start report retry runner.");
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
