#!/usr/bin/env node
// @ts-check

import { spawn } from "node:child_process";

const SCRIPT_NAME = "advertising-integration-scaffold";

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = "dry-run";
  let limit = Infinity;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") mode = "apply";
    if (args[i] === "--dry-run") mode = "dry-run";
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    } else if (args[i].startsWith("--limit=")) {
      limit = parseInt(args[i].split("=")[1], 10);
    }
  }
  return { mode, limit };
}

async function main() {
  const { mode, limit } = parseArgs();
  console.log(`[${SCRIPT_NAME}] mode=${mode} limit=${limit}`);

  if (process.env.KT_ADVERTISING_INTEGRATION_APPROVED !== "true") {
    console.error("Advertising integration tests are deferred until consolidated validation approves an isolated PostgreSQL run.");
    process.exitCode = 1;
    return;
  }

  if (mode === "dry-run") {
    console.log(`[${SCRIPT_NAME}] DRY RUN — Would launch advertising integration vitest suite`);
    return;
  }

  console.log(`[${SCRIPT_NAME}] Spawning advertising vitest integration tests...`);
  const child = spawn("npx", ["vitest", "run", "--config", "vitest.advertising-integration.config.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
});
