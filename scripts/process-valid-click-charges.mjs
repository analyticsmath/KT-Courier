import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";
const args = process.argv.slice(2);
let apply = false, modeSet = false, limit = 50, limitSet = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply" || args[i] === "--dry-run") {
    if (modeSet) throw new Error("Specify one mode.");
    apply = args[i] === "--apply"; modeSet = true;
  } else if (args[i] === "--limit" && !limitSet && i + 1 < args.length) { limit = Number(args[++i]); limitSet = true; }
  else throw new Error("Usage: node scripts/process-valid-click-charges.mjs [--dry-run|--apply] [--limit N]");
}
if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Limit must be between 1 and 200.");
const unregister = register(); const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, batch] = await Promise.all([import("../lib/db/prisma.ts"), import("../lib/advertising/click-charge-batch.ts")]);
  prisma = database.prisma;
  const result = await batch.runAdvertisingClickBatch({ limit, apply });
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...result }));
  if (result.failed) process.exitCode = 1;
} catch { console.error("Advertising click processing failed or is not authorized."); process.exitCode = 1; }
finally { if (prisma) await prisma.$disconnect(); unregisterCommonJs(); unregister(); }
