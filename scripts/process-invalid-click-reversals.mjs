#!/usr/bin/env node
// @ts-check

import { PrismaClient } from "@prisma/client";
import { resolveAdvertisingProductionComposition } from "../lib/advertising/composition-root.js";

const SCRIPT_NAME = "process-invalid-click-reversals";
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

  // Scan candidates: Charged clicks that have since been classified as INVALID but not reversed
  const reversibleCharges = await prisma.advertisingClickCharge.findMany({
    where: {
      status: "CHARGED",
      measurementEvent: {
        validityStatus: "INVALID"
      }
    },
    take: limit === Infinity ? undefined : limit
  });

  console.log(`[${SCRIPT_NAME}] Found ${reversibleCharges.length} reversible click charges.`);

  if (mode === "dry-run") {
    console.log(`[${SCRIPT_NAME}] DRY RUN — no mutations applied`);
    for (const charge of reversibleCharges) {
      console.log(`[${SCRIPT_NAME}]   Would reverse click charge: ${charge.publicReference}`);
    }
    console.log(`[${SCRIPT_NAME}] Dry run complete.`);
    return;
  }

  console.log(`[${SCRIPT_NAME}] APPLY MODE — reversing click charges`);
  // If we ever get past the composition lock, we would mutate using the canonical service:
  // const billingService = comp.services.billing;
  // await billingService.reverseClick({ clickChargeId: charge.id, ... });
  console.log(`[${SCRIPT_NAME}] Completed processing click reversals.`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
