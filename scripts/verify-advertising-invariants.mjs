#!/usr/bin/env node
// @ts-check

import { PrismaClient } from "@prisma/client";

const SCRIPT_NAME = "verify-advertising-invariants";
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

  console.log(`[${SCRIPT_NAME}] Running advertising invariants verification...`);

  // Invariant 1: Funding allocation sum integrity
  // spentAmount + remainingAmount + returnedAmount == originalAmount
  const allocations = await prisma.advertisingFundingAllocation.findMany({
    take: limit === Infinity ? undefined : limit
  });
  let allocationFailures = 0;
  for (const alloc of allocations) {
    const sum = alloc.spentAmount.add(alloc.remainingAmount).add(alloc.returnedAmount);
    if (!sum.equals(alloc.originalAmount)) {
      console.error(`❌ Invariant Failure: Allocation ${alloc.publicReference} has mismatch: original=${alloc.originalAmount.toFixed(2)}, sum=${sum.toFixed(2)}`);
      allocationFailures++;
    }
  }

  // Invariant 2: Click charge validity
  // Every click charge has a corresponding measurement event with validityStatus == VALID
  const charges = await prisma.advertisingClickCharge.findMany({
    include: { measurementEvent: true },
    take: limit === Infinity ? undefined : limit
  });
  let chargeFailures = 0;
  for (const chg of charges) {
    if (!chg.measurementEvent) {
      console.error(`❌ Invariant Failure: Click charge ${chg.publicReference} is missing measurement event.`);
      chargeFailures++;
    } else if (chg.measurementEvent.validityStatus !== "VALID") {
      console.error(`❌ Invariant Failure: Click charge ${chg.publicReference} points to non-valid event status: ${chg.measurementEvent.validityStatus}`);
      chargeFailures++;
    }
  }

  console.log(`[${SCRIPT_NAME}] Verification completed.`);
  console.log(`   - Allocation Integrity Failures: ${allocationFailures}`);
  console.log(`   - Click Charge Validity Failures: ${chargeFailures}`);

  if (allocationFailures > 0 || chargeFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
