import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

const args = process.argv.slice(2);
const match = args.length === 1 && /^--limit=(\d+)$/.exec(args[0]);
if (args.length && !match) throw new Error("Usage: node scripts/expire-report-jobs.mjs [--limit=1..500]");
const limit = match ? Number(match[1]) : 100;
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Report expiry batch size must be between 1 and 500.");
const unregister = register();
const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, expiry, lock, environment] = await Promise.all([
    import("../lib/db/prisma.ts"), import("../lib/reporting/report-expiry-batch.ts"),
    import("../lib/reporting/production-readiness.ts"), import("../lib/promotions/production-lock.ts"),
  ]);
  prisma = database.prisma;
  if (environment.isActualProductionInstance(process.env)) lock.assertReportingProductionReady();
  const result = await expiry.expireReportArtifacts({ limit });
  console.log(`Report expiry: ${result.examined} examined, ${result.deleted} deleted, ${result.alreadyAbsent} already absent, ${result.skipped} skipped, ${result.failed} failed.`);
  if (result.failed || result.skipped) process.exitCode = 1;
} catch {
  console.error("Report expiry failed; check storage and database configuration.");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs();
  unregister();
}
