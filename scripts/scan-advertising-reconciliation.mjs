import { PrismaClient } from "@prisma/client";
import { AdvertisingReconciliationService } from "../lib/advertising/reconciliation.service.js";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 24 Advertising Reconciliation Scanner ===");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const limitArg = args.find(arg => arg.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
void limit;

  if (!dryRun && !apply) {
    console.log("Usage: node scan-advertising-reconciliation.mjs [--dry-run | --apply] [--limit=N]");
    console.log("Defaulting to --dry-run mode.");
  }

  const isDryRun = !apply;

  if (apply) {
    console.log("Initializing production composition root for reconciliation scan...");
    const comp = resolveAdvertisingProductionComposition();
    if (comp.status === "LOCKED") {
      console.error(`❌ Processor Composition Locked: ${comp.code} - ${comp.message}`);
      process.exit(1);
    }
  }

  const service = new AdvertisingReconciliationService();

  try {
    if (isDryRun) {
      console.log("[DRY RUN] Would scan for reconciliation discrepancies and log open cases.");
    } else {
      const cases = await service.scanForReconciliationDiscrepancies();
      console.log(`Scan completed. Logged ${cases.length} new reconciliation cases.`);
    }
  } catch (error) {
    console.error("Fatal error running reconciliation scanner:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
