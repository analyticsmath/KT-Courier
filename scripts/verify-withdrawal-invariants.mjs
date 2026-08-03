import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const legacyCompatibilityColumns = [
  "reviewedByUserId",
  "bankName",
  "accountHolder",
  "accountLast4",
  "rejectionReason",
  "metadata",
  "reviewedAt",
  "paidAt",
];
const compatibilityColumnValues = legacyCompatibilityColumns.map((column) => `('${column}')`).join(", ");
const checks = [
  ["open withdrawals have reserve journals", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "status"::text IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','RECONCILIATION_REQUIRED') AND "reserveLedgerJournalId" IS NULL`],
  ["rejected/cancelled withdrawals have releases", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "status"::text IN ('REJECTED','CANCELLED') AND "releaseLedgerJournalId" IS NULL`],
  ["paid withdrawals have payouts", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "status"::text = 'PAID' AND "payoutLedgerJournalId" IS NULL`],
  ["withdrawals have both release and payout", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "releaseLedgerJournalId" IS NOT NULL AND "payoutLedgerJournalId" IS NOT NULL`],
  ["reserve journals are correct", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" w JOIN "LedgerJournal" j ON j."id" = w."reserveLedgerJournalId" WHERE j."type"::text <> 'WITHDRAWAL_RESERVE' OR j."currency"::text <> 'ZAR' OR j."totalDebits" <> w."amount" OR j."totalCredits" <> w."amount"`],
  ["release journals are correct", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" w JOIN "LedgerJournal" j ON j."id" = w."releaseLedgerJournalId" WHERE j."type"::text <> 'WITHDRAWAL_RELEASE' OR j."totalDebits" <> w."amount" OR j."totalCredits" <> w."amount"`],
  ["payout journals debit held and credit cash clearing", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" w JOIN "LedgerJournal" j ON j."id" = w."payoutLedgerJournalId" WHERE j."type"::text <> 'WITHDRAWAL_PAYOUT' OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND e."direction"::text = 'DEBIT' AND a."purpose"::text = 'WITHDRAWAL_HELD') OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND e."direction"::text = 'CREDIT' AND a."purpose"::text = 'CASH_CLEARING')`],
  ["paid withdrawals lack successful attempts", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" w WHERE w."status"::text = 'PAID' AND NOT EXISTS (SELECT 1 FROM "WithdrawalPayoutAttempt" a WHERE a."withdrawalId" = w."id" AND a."status"::text = 'SUCCEEDED' AND a."externalReference" IS NOT NULL)`],
  ["maker checker violations", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "status"::text = 'PAID' AND ("approvedByUserId" IS NULL OR "approvedByUserId" = "completedByUserId" OR "requestedByUserId" = "completedByUserId")`],
  ["withdrawal revenue or fee posting", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text IN ('WITHDRAWAL_RESERVE','WITHDRAWAL_RELEASE','WITHDRAWAL_PAYOUT') AND (COALESCE("metadata"::text, '') ~* 'fee|revenue')`],
  ["withdrawal compatibility columns missing", `SELECT COUNT(*)::int AS count FROM (VALUES ${compatibilityColumnValues}) AS expected(column_name) LEFT JOIN information_schema.columns actual ON actual.table_schema = 'public' AND actual.table_name = 'WithdrawalRequest' AND actual.column_name = expected.column_name WHERE actual.column_name IS NULL`],
  ["structured withdrawals populate compatibility columns", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "creationIdempotencyKey" IS NOT NULL AND ("reviewedByUserId" IS NOT NULL OR "bankName" IS NOT NULL OR "accountHolder" IS NOT NULL OR "accountLast4" IS NOT NULL OR "rejectionReason" IS NOT NULL OR "metadata" IS NOT NULL OR "reviewedAt" IS NOT NULL OR "paidAt" IS NOT NULL)`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = Number(rows[0]?.count ?? 0); console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`); if (count) failures.push(name); }
  const source = await Promise.all(["withdrawal-request.service.ts", "withdrawal-finance-review.service.ts", "withdrawal-payout.service.ts", "withdrawal-query.service.ts"].map((file) => readFile(new URL(`../lib/services/${file}`, import.meta.url), "utf8")));
  const withdrawalSource = source.join("\n");
  if (/\b(?:tx\.)?(?:order|payment|paymentRefund|commission|walletTransaction)\.(?:create|update|updateMany|upsert|delete)/.test(withdrawalSource)) failures.push("withdrawal services cross module boundary");
  if (new RegExp(`\\bwithdrawal\\.(?:${legacyCompatibilityColumns.join("|")})\\b`).test(withdrawalSource)) failures.push("withdrawal services read legacy compatibility columns");
  if (new RegExp(`withdrawalRequest\\.(?:create|update|updateMany|upsert)[\\s\\S]{0,2000}?\\b(?:${legacyCompatibilityColumns.join("|")})\\s*:`, "m").test(withdrawalSource)) failures.push("withdrawal services write legacy compatibility columns");
  if (failures.length) throw new Error(`Withdrawal invariant verification failed: ${failures.join("; ")}.`);
  console.log("Withdrawal invariant verification passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Withdrawal invariant verification failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
