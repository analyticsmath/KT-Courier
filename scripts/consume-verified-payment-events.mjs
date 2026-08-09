import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit = Number(limitIndex >= 0 ? args[limitIndex + 1] : 100);
if (apply === dryRun || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
  throw new Error("Use exactly one of --apply or --dry-run with a --limit between 1 and 500.");
}

if (dryRun) {
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRawUnsafe(`SELECT "publicReference", "paymentReference", "subjectType", "createdAt" FROM "PaymentVerifiedEventIntent" ORDER BY "createdAt" ASC LIMIT ${limit}`);
    console.log(JSON.stringify({ processor: "PAYMENT_SUCCEEDED_VERIFIED", dryRun: true, candidates: rows }, null, 2));
  } finally {
    await db.$disconnect();
  }
} else {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase4-consume-verified-payment-events.worker.ts", "--limit", String(limit)], { stdio: "inherit", cwd: process.cwd() });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
