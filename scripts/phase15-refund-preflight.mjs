import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["legacy refund placeholder rows", `SELECT COUNT(*)::int AS count FROM "PaymentRefund"`],
  ["successful payments without immutable success evidence", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "status"::text = 'SUCCEEDED' AND ("successfulAttemptId" IS NULL OR "successWebhookEventId" IS NULL OR "successLedgerJournalId" IS NULL)`],
  ["non-ZAR successful payments", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "status"::text = 'SUCCEEDED' AND "currency"::text <> 'ZAR'`],
  ["legacy duplicate provider refund references", `SELECT COUNT(*)::int AS count FROM (SELECT "providerReference" FROM "PaymentRefund" WHERE "providerReference" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1) x`],
  ["legacy over-refunded payments", `SELECT COUNT(*)::int AS count FROM "Payment" p WHERE COALESCE((SELECT SUM(r."amount") FROM "PaymentRefund" r WHERE r."paymentId" = p."id"), 0) > p."amount"`],
  ["unlinked refund journals", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text LIKE 'REFUND_%'`],
  ["downstream commission releases", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" WHERE "status"::text = 'RELEASED' OR "downstreamReleaseJournalId" IS NOT NULL`],
  ["customer wallet account conflicts", `SELECT COUNT(*)::int AS count FROM "LedgerAccount" a JOIN "Wallet" w ON w."id" = a."walletId" WHERE a."purpose"::text IN ('CUSTOMER_WALLET_AVAILABLE','CUSTOMER_REFUND_HELD') AND (w."ownerType"::text <> 'CUSTOMER' OR a."category"::text <> 'LIABILITY' OR a."currency"::text <> 'ZAR' OR a."allowNegative")`],
  ["production refund provider activity", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" WHERE "providerReference" IS NOT NULL`],
  ["legacy raw banking data", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" WHERE COALESCE("reason", '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)' OR COALESCE("metadata"::text, '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)'`],
];

async function rawBankingColumns() {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('PaymentRefund','RefundExecutionAttempt','RefundReconciliationCase') AND lower(column_name) ~ '(bank|accountnumber|branchcode|cardnumber|cvv|cvc|routing|iban|swift)'`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const blockers = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = Number(rows[0]?.count ?? 0); console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`); if (count) blockers.push(name); }
  const banking = await rawBankingColumns(); console.log(`${banking ? "BLOCK" : "CLEAR"}: raw banking columns${banking ? ` (${banking})` : ""}`); if (banking) blockers.push("raw banking columns");
  if (blockers.length) throw new Error(`Phase 15 refund preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 15 refund preflight passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Phase 15 refund preflight failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
