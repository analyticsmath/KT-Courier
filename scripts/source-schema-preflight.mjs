import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const suite = process.argv[2] === "--suite" ? process.argv[3] : undefined;
if (!suite || !["phase-b", "gate4"].includes(suite)) {
  throw new Error("Usage: node scripts/source-schema-preflight.mjs --suite <phase-b|gate4>");
}

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");

function run(command, args, label, env = process.env, shell = false) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: "inherit", shell });
  if (result.error || result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 1}: ${result.error?.message ?? "command failed"}`);
}

console.log(`SOURCE_SCHEMA_PREFLIGHT=START suite=${suite}`);
run(process.execPath, [prismaCli, "validate", "--schema", "prisma/schema.prisma"], "Prisma schema validation");
run(process.execPath, [prismaCli, "generate", "--schema", "prisma/schema.prisma"], "Prisma client generation");

if (suite === "phase-b") {
  run(process.execPath, ["scripts/phase-b-proof-source-preflight.mjs"], "Phase B proof-source preflight");
} else {
  const preflightEnv = { ...process.env };
  delete preflightEnv.DATABASE_URL;
  delete preflightEnv.SHADOW_DATABASE_URL;
  run(process.execPath, ["scripts/run-gate4-integration.mjs", "--preflight-only"], "Gate 4 source preflight", preflightEnv);
}

console.log(`SOURCE_SCHEMA_PREFLIGHT=PASSED suite=${suite}`);
