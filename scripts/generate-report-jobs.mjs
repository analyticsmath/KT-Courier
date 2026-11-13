import { register } from "tsx/esm/api";
import { register as registerCommonJs } from "tsx/cjs/api";

const args = process.argv.slice(2);
const match = args.length === 1 && /^--limit=(\d+)$/.exec(args[0]);
if (args.length && !match) throw new Error("Usage: node scripts/generate-report-jobs.mjs [--limit=1..50]");
const limit = match ? Number(match[1]) : 10;
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Report batch size must be between 1 and 50.");

const unregister = register();
const unregisterCommonJs = registerCommonJs();
let prisma;
try {
  const [database, reporting, lock, environment] = await Promise.all([
    import("../lib/db/prisma.ts"), import("../lib/reporting/report-batch.ts"),
    import("../lib/reporting/production-readiness.ts"), import("../lib/promotions/production-lock.ts"),
  ]);
  prisma = database.prisma;
  if (environment.isActualProductionInstance(process.env)) lock.assertReportingProductionReady();
  const result = await reporting.runReportBatch(limit);
  console.log(`Report batch: ${result.examined} examined, ${result.completed} completed, ${result.skipped} skipped, ${result.failed} failed.`);
  if (result.failed) process.exitCode = 1;
} catch (error) {
  console.error("Report batch failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  if (prisma) await prisma.$disconnect();
  unregisterCommonJs();
  unregister();
}
