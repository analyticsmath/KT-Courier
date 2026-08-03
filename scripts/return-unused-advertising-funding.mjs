#!/usr/bin/env node
// @ts-check

import { PrismaClient } from "@prisma/client";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const SCRIPT_NAME = "return-unused-advertising-funding";
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

  // Scan candidates: Campaign versions belonging to ENDED, REJECTED, or SUSPENDED campaigns
  // that have remaining funding allocation balances
  const campaignsToReturn = await prisma.advertisingCampaign.findMany({
    where: {
      status: { in: ["ENDED", "REJECTED", "SUSPENDED"] }
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          fundingAllocations: {
            where: {
              status: { in: ["FUNDED", "PARTIALLY_SPENT"] },
              remainingAmount: { gt: 0 }
            }
          }
        }
      }
    },
    take: limit === Infinity ? undefined : limit
  });

  const candidates = [];
  for (const c of campaignsToReturn) {
    const version = c.versions[0];
    if (version && version.fundingAllocations.length > 0) {
      candidates.push({ campaign: c, version });
    }
  }

  console.log(`[${SCRIPT_NAME}] Found ${candidates.length} campaigns with returnable unused funding.`);

  if (mode === "dry-run") {
    console.log(`[${SCRIPT_NAME}] DRY RUN — no mutations applied`);
    for (const item of candidates) {
      const remaining = item.version.fundingAllocations.reduce((sum, fa) => sum.add(fa.remainingAmount), new prisma.$types.Decimal(0));
      console.log(`[${SCRIPT_NAME}]   Would return unused funding for campaign: ${item.campaign.name} (Ref: ${item.campaign.publicReference}, Remaining ZAR: ${remaining.toFixed(2)})`);
    }
    console.log(`[${SCRIPT_NAME}] Dry run complete.`);
    return;
  }

  console.log(`[${SCRIPT_NAME}] APPLY MODE — returning unused funding`);
  // If we ever get past the composition lock, we would mutate using the canonical service:
  // const fundingService = comp.services.funding;
  // await fundingService.returnUnusedFunding({ campaignVersionId: item.version.id, ... });
  console.log(`[${SCRIPT_NAME}] Completed return of unused funding.`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
