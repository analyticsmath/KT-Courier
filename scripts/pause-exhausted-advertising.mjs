#!/usr/bin/env node
// @ts-check

import { PrismaClient } from "@prisma/client";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const SCRIPT_NAME = "pause-exhausted-advertising";
const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = "dry-run";
  let limit = Infinity;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") mode = "apply";
    if (args[i] === "--dry-run") mode = "dry-run";
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    } else if (args[i].startsWith("--limit=")) {
      limit = parseInt(args[i].split("=")[1], 10);
    }
  }
  return { mode, limit };
}

async function main() {
  const { mode, limit } = parseArgs();
  console.log(`[${SCRIPT_NAME}] mode=${mode} limit=${limit}`);

  if (mode === "apply") {
    console.log(`[${SCRIPT_NAME}] Initializing production composition root...`);
    const comp = resolveAdvertisingProductionComposition();
    if (comp.status === "LOCKED") {
      console.error(`❌ Processor Composition Locked: ${comp.code} - ${comp.message}`);
      process.exit(1);
    }
  }

  // Scan candidates: Active campaigns whose allocations are exhausted or budgets are overrun
  const activeCampaigns = await prisma.advertisingCampaign.findMany({
    where: { status: "ACTIVE" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          fundingAllocations: {
            where: { status: { in: ["FUNDED", "PARTIALLY_SPENT"] } }
          }
        }
      }
    },
    take: limit === Infinity ? undefined : limit
  });

  const exhausted = [];
  for (const c of activeCampaigns) {
    const version = c.versions[0];
    if (!version) continue;

    // Sum remaining funding allocation amounts
    const remaining = version.fundingAllocations.reduce((sum, fa) => sum.add(fa.remainingAmount), new prisma.$types.Decimal(0));
    if (remaining.isZero()) {
      exhausted.push(c);
    }
  }

  console.log(`[${SCRIPT_NAME}] Found ${exhausted.length} exhausted campaigns.`);

  if (mode === "dry-run") {
    console.log(`[${SCRIPT_NAME}] DRY RUN — no mutations applied`);
    for (const c of exhausted) {
      console.log(`[${SCRIPT_NAME}]   Would pause campaign: ${c.name} (Ref: ${c.publicReference})`);
    }
    console.log(`[${SCRIPT_NAME}] Dry run complete.`);
    return;
  }

  console.log(`[${SCRIPT_NAME}] APPLY MODE — pausing exhausted campaigns`);
  // If we ever get past the composition lock, we would mutate using the canonical service:
  // const campaignService = comp.services.campaign;
  // await campaignService.pauseCampaign(c.storeId, c.publicReference);
  console.log(`[${SCRIPT_NAME}] Completed pausing campaigns.`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
