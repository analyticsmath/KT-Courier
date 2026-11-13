import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

const args = process.argv.slice(2);
let apply = false, modeSet = false, limit = 100, after;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply" || args[i] === "--dry-run") {
    if (modeSet) throw new Error("Specify one mode.");
    apply = args[i] === "--apply"; modeSet = true;
  } else if (args[i] === "--limit" && i + 1 < args.length) limit = Number(args[++i]);
  else if (args[i] === "--after" && i + 1 < args.length) after = args[++i];
  else throw new Error("Usage: node scripts/scan-promotion-reconciliation.mjs [--dry-run|--apply] [--limit N] [--after ID]");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Limit must be between 1 and 500.");
const unregister = register(); const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, scan, lock] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/promotions/promotion-reconciliation-scan.ts"), import("../lib/promotions/production-lock.ts")]);
  prisma = database.prisma;
  if (apply) lock.assertPromotionsProductionReady("RECONCILIATION");
  const result = await scan.scanPromotionBudgetReconciliation({ limit, after, apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }));
} catch {
  console.error("Promotion reconciliation scan failed or is not authorized.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs(); unregister();
}
