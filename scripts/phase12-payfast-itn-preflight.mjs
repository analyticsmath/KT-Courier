import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["unsupported legacy webhook rows", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "eventFingerprint" IS NULL OR "publicReference" IS NULL`],
  ["unsupported webhook processing states", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "itnProcessingStatus"::text NOT IN ('RECEIVED','REJECTED','VERIFIED','APPLIED','DUPLICATE','IGNORED_STALE','RECONCILIATION_REQUIRED','TEMPORARY_FAILURE')`],
  ["legacy compatibility fields populated on Phase 12 receipts", `SELECT COUNT(*)::int AS count FROM "PaymentWebhookEvent" WHERE "providerEventId" IS NOT NULL OR "eventType" IS NOT NULL OR "processingStatus" IS NOT NULL OR "signatureValid" IS NOT NULL OR "payload" IS NOT NULL OR "errorMessage" IS NOT NULL OR "processedAt" IS NOT NULL`],
  ["incoherent existing reconciliation rows", `SELECT COUNT(*)::int AS count FROM "PaymentReconciliationCase" WHERE "paymentId" IS NULL OR "reason" IS NULL OR "caseKey" IS NULL`],
  ["successful payments without provider evidence", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "status"::text = 'SUCCEEDED' AND ("successfulAttemptId" IS NULL OR "successWebhookEventId" IS NULL OR "successLedgerJournalId" IS NULL OR "providerConfirmedAt" IS NULL)`],
  ["provider references without verified events", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" a WHERE a."providerReference" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PaymentWebhookEvent" e WHERE e."attemptId" = a."id" AND e."providerPaymentId" = a."providerReference" AND e."providerDataVerified")`],
  ["ledger links without success evidence", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "successLedgerJournalId" IS NOT NULL AND ("successWebhookEventId" IS NULL OR "successfulAttemptId" IS NULL)`],
  ["duplicate provider payment IDs", `SELECT COUNT(*)::int AS count FROM (SELECT "provider", "providerReference" FROM "PaymentAttempt" WHERE "providerReference" IS NOT NULL GROUP BY "provider", "providerReference" HAVING COUNT(*) > 1) d`],
  ["Payfast attempts missing credential versions", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerCredentialVersion" IS NULL`],
  ["non-ZAR payment evidence", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "currency"::text <> 'ZAR' UNION ALL SELECT COUNT(*)::int FROM "PaymentAttempt" WHERE "currency"::text <> 'ZAR'`],
  ["payment/attempt amount inconsistencies", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" a JOIN "Payment" p ON p."id" = a."paymentId" WHERE a."amount" <> p."amount" OR a."currency" <> p."currency"`],
  ["platform held account conflicts", `SELECT COUNT(*)::int AS count FROM "LedgerAccount" a JOIN "Wallet" w ON w."id" = a."walletId" WHERE a."code" = 'PLATFORM-CUSTOMER-FUNDS-HELD-ZAR' AND (w."ownerType"::text <> 'PLATFORM' OR w."ownerId" <> 'platform' OR a."purpose"::text <> 'HELD' OR a."category"::text <> 'LIABILITY' OR a."currency"::text <> 'ZAR')`],
  ["missing platform held account", `SELECT CASE WHEN EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "code" = 'PLATFORM-CUSTOMER-FUNDS-HELD-ZAR') THEN 0 ELSE 1 END::int AS count`],
  ["incompatible production attempts", `SELECT COUNT(*)::int AS count FROM "PaymentAttempt" WHERE "provider"::text = 'PAYFAST' AND "providerEnvironment"::text = 'PRODUCTION' AND "status"::text NOT IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED')`],
];

async function main() {
  const blockers = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    const count = rows.reduce((total, row) => total + Number(row.count ?? 0), 0);
    console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`);
    if (count) blockers.push(name);
  }
  if (blockers.length) throw new Error(`Phase 12 payment confirmation preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 12 payment confirmation preflight passed.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Phase 12 preflight failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
