import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const blockers = [];

async function scalar(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.count ?? 0);
}

async function check(label, sql) {
  const count = await scalar(sql);
  console.log(`${count ? "BLOCK" : "CLEAR"}: ${label}${count ? ` (${count})` : ""}`);
  if (count) blockers.push(label);
}

async function main() {
  await check(
    "orphan dispatch-evaluation evidence",
    `SELECT COUNT(*)::int count
     FROM "DispatchCandidateEvidence" evidence
     LEFT JOIN "DispatchCandidateEvaluation" evaluation ON evaluation."id" = evidence."evaluationId"
     WHERE evaluation."id" IS NULL`
  );
  await check(
    "conflicting payment-provider webhook fingerprints",
    `SELECT COUNT(*)::int count
     FROM (
       SELECT "eventFingerprint"
       FROM "PaymentWebhookEvent"
       GROUP BY "eventFingerprint"
       HAVING COUNT(*) > 1
     ) conflicts`
  );
  await check(
    "duplicate subscription billing-cycle numbers",
    `SELECT COUNT(*)::int count
     FROM (
       SELECT "contractId", "cycleNumber"
       FROM "SubscriptionBillingCycle"
       GROUP BY "contractId", "cycleNumber"
       HAVING COUNT(*) > 1
     ) duplicates`
  );
  await check(
    "duplicate subscription billing-cycle periods",
    `SELECT COUNT(*)::int count
     FROM (
       SELECT "contractId", "periodStart", "periodEnd"
       FROM "SubscriptionBillingCycle"
       GROUP BY "contractId", "periodStart", "periodEnd"
       HAVING COUNT(*) > 1
     ) duplicates`
  );
  await check(
    "duplicate recruitment applicant-profile owners",
    `SELECT COUNT(*)::int count
     FROM (
       SELECT "userId"
       FROM "RecruitmentApplicantProfile"
       GROUP BY "userId"
       HAVING COUNT(*) > 1
     ) duplicates`
  );
  await check(
    "store offers with missing current-price references",
    `SELECT COUNT(*)::int count
     FROM "StoreCatalogOffer" offer
     LEFT JOIN "StoreOfferPriceVersion" price ON price."id" = offer."currentPriceVersionId"
     WHERE offer."currentPriceVersionId" IS NOT NULL AND price."id" IS NULL`
  );
  await check(
    "store offers with missing primary-inventory-location references",
    `SELECT COUNT(*)::int count
     FROM "StoreCatalogOffer" offer
     LEFT JOIN "InventoryLocation" location ON location."id" = offer."primaryInventoryLocationId"
     WHERE offer."primaryInventoryLocationId" IS NOT NULL AND location."id" IS NULL`
  );

  if (blockers.length > 0) {
    throw new Error(`Schema drift reconciliation preflight blocked: ${blockers.join("; ")}.`);
  }

  console.log("Schema drift reconciliation preflight passed. The migration separately validates backfilled dispatch order and promoter currency values before enforcement.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Schema drift reconciliation preflight failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
