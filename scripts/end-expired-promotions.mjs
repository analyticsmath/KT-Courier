import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

const args = process.argv.slice(2);
let apply = false, modeSet = false, limit = 100, limitSet = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply" || args[i] === "--dry-run") {
    if (modeSet) throw new Error("Specify one mode.");
    apply = args[i] === "--apply"; modeSet = true;
  } else if (args[i] === "--limit" && !limitSet && i + 1 < args.length) {
    limit = Number(args[++i]); limitSet = true;
  } else throw new Error("Usage: node scripts/end-expired-promotions.mjs [--dry-run|--apply] [--limit N]");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Limit must be between 1 and 500.");
const unregister = register();
const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, expiry] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/promotions/promotion-expiry-batch.ts")]);
  prisma = database.prisma;
  const result = await expiry.expirePromotionCampaigns({ limit, apply });
  console.log(`Promotion expiry (${apply ? "apply" : "dry-run"}): ${result.examined} examined, ${result.ended} ended, ${result.skipped} skipped, ${result.failed} failed.`);
  if (result.failed) process.exitCode = 1;
} catch {
  console.error("Promotion expiry failed or is not authorized.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs(); unregister();
}
