import { PrismaClient } from "@prisma/client";
import { AdvertisingCampaignService } from "../lib/advertising/campaign.service.js";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 24 Advertising Activation Job ===");

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const limitArg = args.find(arg => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : null;

  if (!dryRun && !apply) {
    console.log("Usage: node activate-approved-advertising.mjs [--dry-run | --apply] [--limit=N]");
    console.log("Defaulting to --dry-run mode.");
  }

  const isDryRun = !apply;

  if (apply) {
    console.log("Initializing production composition root for activation...");
    const comp = resolveAdvertisingProductionComposition();
    if (comp.status === "LOCKED") {
      console.error(`❌ Processor Composition Locked: ${comp.code} - ${comp.message}`);
      process.exit(1);
    }
  }

  const service = new AdvertisingCampaignService();

  try {
    const now = new Date();
    // Load campaigns that are APPROVED or SCHEDULED with versions due for activation
    const dueCampaigns = await prisma.advertisingCampaign.findMany({
      where: {
        status: { in: ["APPROVED", "SCHEDULED"] },
        versions: {
          some: {
            startsAt: { lte: now },
            endsAt: { gte: now },
            status: "DRAFT"
          }
        }
      },
      take: limit || undefined
    });

    console.log(`Found ${dueCampaigns.length} campaigns due for activation.`);

    for (const c of dueCampaigns) {
      if (isDryRun) {
        console.log(`[DRY RUN] Would activate campaign: ${c.name} (Ref: ${c.publicReference})`);
      } else {
        try {
          await service.activateCampaign(c.publicReference, { ["approved"]: true });
          console.log(`✔ Activated campaign: ${c.name} (Ref: ${c.publicReference})`);
        } catch (err) {
          console.error(`❌ Failed to activate campaign ${c.publicReference}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error("Fatal error running activation job:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
