import { PrismaClient } from "@prisma/client";
import { AdvertisingCampaignService } from "../lib/advertising/campaign.service.js";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 24 Advertising Ending Job ===");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const limitArg = args.find(arg => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;

  if (!dryRun && !apply) {
    console.log("Usage: node end-expired-advertising.mjs [--dry-run | --apply] [--limit=N]");
    console.log("Defaulting to --dry-run mode.");
  }

  const isDryRun = !apply;

  if (apply) {
    console.log("Initializing production composition root for ending expired campaigns...");
    const comp = resolveAdvertisingProductionComposition();
    if (comp.status === "LOCKED") {
      console.error(`❌ Processor Composition Locked: ${comp.code} - ${comp.message}`);
      process.exit(1);
    }
  }

  const service = new AdvertisingCampaignService();

  try {
    const now = new Date();
    // Load campaigns that are active or paused but past their endsAt
    const expiredCampaigns = await prisma.advertisingCampaign.findMany({
      where: {
        status: { in: ["ACTIVE", "PAUSED"] },
        versions: {
          some: {
            endsAt: { lte: now }
          }
        }
      },
      take: limit || undefined
    });

    console.log(`Found ${expiredCampaigns.length} expired campaigns.`);

    for (const c of expiredCampaigns) {
      if (isDryRun) {
        console.log(`[DRY RUN] Would end campaign: ${c.name} (Ref: ${c.publicReference})`);
      } else {
        try {
          await service.endCampaign(c.storeId, c.publicReference);
          console.log(`✔ Ended campaign: ${c.name} (Ref: ${c.publicReference})`);
        } catch (err) {
          console.error(`❌ Failed to end campaign ${c.publicReference}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error("Fatal error running ending job:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
