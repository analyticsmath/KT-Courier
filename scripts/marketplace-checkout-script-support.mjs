import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export const MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false;

export function parseMarketplaceProcessorArguments(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply"); const dryRun = argv.includes("--dry-run");
  if (apply && dryRun) throw new Error("Choose either --dry-run or --apply.");
  const limitIndex = argv.indexOf("--limit"); const rawLimit = limitIndex === -1 ? "100" : argv[limitIndex + 1];
  if (!/^\d+$/.test(rawLimit ?? "")) throw new Error("--limit must be a positive integer.");
  const limit = Number(rawLimit); if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be between 1 and 500.");
  return Object.freeze({ apply, dryRun: !apply, limit });
}

export async function runBoundedMarketplaceScan(name, selectSql, worker) {
  const options = parseMarketplaceProcessorArguments(); const prisma = new PrismaClient();
  try {
    const candidates = await prisma.$queryRawUnsafe(selectSql(options.limit));
    if (options.dryRun) { console.log(JSON.stringify({ name, dryRun: true, limit: options.limit, candidates }, null, 2)); return; }
    // The worker contains the canonical application service. Its source gate is
    // deliberately the only apply gate; this wrapper never mutates financial or stock state.
    const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", worker, "--limit", String(options.limit)], { stdio: "inherit", cwd: process.cwd() });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  } finally { await prisma.$disconnect(); }
}
