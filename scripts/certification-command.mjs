import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { sanitize } from "./docker-common.mjs";
const command = process.argv[2];
if (!/^(test:(coverage|payments|refunds|security:bola|processors|e2e|integration:[a-z-]+)|docker:(migration-smoke|gate4))$/.test(command ?? "")) throw new Error("Unsupported certification command.");
const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", command, ...process.argv.slice(3)], { env: process.env, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { const safe = sanitize(data.toString()); output += safe; process.stdout.write(safe); });
child.on("error", () => { process.exitCode = 1; });
child.on("close", (code) => {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const skipped = /\b[1-9]\d*\s+(?:skipped|todo|pending)\b|\[SKIP_(?:DB_EXECUTION|TEST)\]/i.test(plain);
  const testFiles = plain.match(/Test Files\s+(\d+)\s+passed/i);
  const tests = plain.match(/Tests\s+(\d+)\s+passed/i);
  mkdirSync("output/production-closure", { recursive: true });
  writeFileSync(`output/production-closure/${command.replaceAll(":", "-")}.json`, JSON.stringify({ command, exitCode: code, testFilesPassed: testFiles ? Number(testFiles[1]) : null, testsPassed: tests ? Number(tests[1]) : null, skippedCriticalTestsDetected: skipped, status: code === 0 && !skipped ? "PASS" : "FAIL" }, null, 2));
  process.exitCode = code === 0 && !skipped ? 0 : 1;
});
