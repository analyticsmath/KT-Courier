import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sanitize } from "./docker-common.mjs";
import { certificationEnvironmentProfile, certificationTestCounts, hasFlakyCriticalTests, hasSkippedCriticalTests, verifyCertificationHead } from "./certification-output.mjs";
const command = process.argv[2];
if (!/^(test:(coverage|payments|refunds|security:bola|processors|e2e|integration:[a-z-]+)|docker:(migration-smoke|gate4))$/.test(command ?? "")) throw new Error("Unsupported certification command.");
const commitSha = verifyCertificationHead(spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim(), process.env.KT_CERTIFICATION_HEAD_SHA);
const sourceTreeSha = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).stdout?.trim();
const started = Date.now();
const startedAt = new Date(started).toISOString();
const args = process.argv.slice(3);
const fullCommand = ["npm", "run", command, ...args].join(" ");
console.log(`CERTIFICATION_HEAD_SHA=${commitSha} SOURCE_TREE_SHA=${sourceTreeSha} COMMAND=${fullCommand}`);
const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", command, ...process.argv.slice(3)], { env: process.env, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { const safe = sanitize(data.toString()); output += safe; process.stdout.write(safe); });
let spawnError = null;
child.on("error", (error) => { spawnError = { code: error.code ?? null, message: sanitize(error.message) }; process.exitCode = 1; });
child.on("close", (code, signal) => {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const skipped = hasSkippedCriticalTests(plain);
  const flaky = hasFlakyCriticalTests(plain);
  const counts = certificationTestCounts(plain);
  mkdirSync("output/production-closure", { recursive: true });
  const ended = Date.now();
  const endedAt = new Date(ended).toISOString();
  const runId = `${started}-${process.pid}`;
  const runDirectory = path.join("output", "production-closure", "command-receipts");
  mkdirSync(runDirectory, { recursive: true });
  const stem = `${command.replaceAll(":", "-")}-${runId}`;
  const stdoutPath = path.join(runDirectory, `${stem}.log`);
  const receiptPath = path.join(runDirectory, `${stem}.json`);
  const status = code === 0 && !skipped && !flaky ? "PASS" : "FAIL";
  const receipt = {
    schemaVersion: 1,
    command,
    arguments: args,
    fullCommand,
    commitSha,
    sourceTreeSha,
    startedAt,
    endedAt,
    durationMs: ended - started,
    process: { exitCode: code, signal: signal ?? null, spawnError },
    ...counts,
    skippedCriticalTestsDetected: skipped,
    flakyCriticalTestsDetected: flaky,
    environment: certificationEnvironmentProfile(process.env, command),
    stdoutPath,
    status,
  };
  writeFileSync(stdoutPath, plain);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  writeFileSync(`output/production-closure/${command.replaceAll(":", "-")}.json`, JSON.stringify({ ...receipt, receiptPath }, null, 2));
  console.log(`CERTIFICATION_RECEIPT=${receiptPath}`);
  process.exitCode = code === 0 && !skipped && !flaky ? 0 : 1;
});
