import { PrismaClient } from "@prisma/client";
import { AdvertisingAggregationService } from "../lib/advertising/aggregation.service.js";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 24 Advertising Aggregation Job ===");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const limitArg = args.find(arg => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
void limit;

  if (!dryRun && !apply) {
    console.log("Usage: node process-advertising-aggregation.mjs [--dry-run | --apply] [--limit=N]");
    console.log("Defaulting to --dry-run mode.");
  }

  const isDryRun = !apply;

  if (apply) {
    console.log("Initializing production composition root for daily aggregation...");
    const comp = resolveAdvertisingProductionComposition();
    if (comp.status === "LOCKED") {
      console.error(`❌ Processor Composition Locked: ${comp.code} - ${comp.message}`);
      process.exit(1);
    }
  }

  const service = new AdvertisingAggregationService();

  try {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);

    if (isDryRun) {
      console.log(`[DRY RUN] Would aggregate metrics for yesterday: ${yesterday.toDateString()}`);
      console.log(`[DRY RUN] Would aggregate metrics for today: ${today.toDateString()}`);
    } else {
      console.log("Aggregating metrics for yesterday...");
      await service.aggregateDailyMetrics(yesterday);
      console.log("✔ Aggregated yesterday's metrics.");

      console.log("Aggregating metrics for today...");
      await service.aggregateDailyMetrics(today);
      console.log("✔ Aggregated today's metrics.");
    }

  } catch (error) {
    console.error("Fatal error running aggregation job:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
