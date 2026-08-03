import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["refunds are positive ZAR", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" WHERE "amount" <= 0 OR "currency"::text <> 'ZAR'`],
  ["successful plus reserved refunds do not exceed payment", `SELECT COUNT(*)::int AS count FROM "Payment" WHERE "totalRefundedAmount" < 0 OR "totalRefundReservedAmount" < 0 OR "totalRefundedAmount" + "totalRefundReservedAmount" > "amount"`],
  ["nonterminal refunds have one reserve journal", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r LEFT JOIN "LedgerJournal" j ON j."id" = r."reserveLedgerJournalId" WHERE r."status"::text IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','RECONCILIATION_REQUIRED') AND (j."id" IS NULL OR j."type"::text <> 'REFUND_RESERVE')`],
  ["cancelled and rejected refunds have one release", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r LEFT JOIN "LedgerJournal" j ON j."id" = r."releaseLedgerJournalId" WHERE r."status"::text IN ('CANCELLED','REJECTED') AND (j."id" IS NULL OR j."type"::text <> 'REFUND_RELEASE')`],
  ["successful refunds have one completion", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r LEFT JOIN "LedgerJournal" j ON j."id" = r."completionLedgerJournalId" WHERE r."status"::text = 'SUCCEEDED' AND (j."id" IS NULL OR j."type"::text NOT IN ('REFUND_WALLET_CREDIT','REFUND_EXTERNAL_PAYOUT'))`],
  ["refund cannot have release and completion", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" WHERE "releaseLedgerJournalId" IS NOT NULL AND "completionLedgerJournalId" IS NOT NULL`],
  ["funding allocation sum equals refund", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r WHERE r."amount" <> COALESCE((SELECT SUM(f."amount") FROM "RefundFundingAllocation" f WHERE f."refundId" = r."id"), 0)`],
  ["commission adjustment within original allocation", `SELECT COUNT(*)::int AS count FROM (SELECT f."commissionAllocationId", SUM(f."amount") adjusted, MAX(a."amount") original FROM "RefundFundingAllocation" f JOIN "PaymentRefund" r ON r."id" = f."refundId" JOIN "CommissionAllocation" a ON a."id" = f."commissionAllocationId" WHERE f."commissionAllocationId" IS NOT NULL AND r."status"::text NOT IN ('REJECTED','CANCELLED') GROUP BY f."commissionAllocationId" HAVING SUM(f."amount") > MAX(a."amount")) x`],
  ["final full refunds consume exact original commission", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" a JOIN "CommissionAccrual" c ON c."id" = a."accrualId" JOIN "Payment" p ON c."subjectType"::text = 'COURIER_ORDER' AND c."subjectId" = p."orderId" WHERE p."totalRefundedAmount" + p."totalRefundReservedAmount" = p."amount" AND a."status"::text <> 'RELEASED' AND a."downstreamReleaseJournalId" IS NULL AND COALESCE((SELECT SUM(f."amount") FROM "RefundFundingAllocation" f JOIN "PaymentRefund" r ON r."id" = f."refundId" WHERE f."commissionAllocationId" = a."id" AND r."status"::text NOT IN ('REJECTED','CANCELLED')), 0) <> a."amount"`],
  ["wallet completion direction", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r JOIN "LedgerJournal" j ON j."id" = r."completionLedgerJournalId" WHERE r."method"::text = 'CUSTOMER_WALLET' AND r."status"::text = 'SUCCEEDED' AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND a."purpose"::text = 'CUSTOMER_WALLET_AVAILABLE' AND e."direction"::text = 'CREDIT' AND e."amount" = r."amount")`],
  ["external completion direction", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r JOIN "LedgerJournal" j ON j."id" = r."completionLedgerJournalId" WHERE r."method"::text = 'ORIGINAL_PAYMENT_METHOD' AND r."status"::text = 'SUCCEEDED' AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND a."purpose"::text = 'CASH_CLEARING' AND e."direction"::text = 'CREDIT' AND e."amount" = r."amount")`],
  ["duplicate provider refund IDs", `SELECT COUNT(*)::int AS count FROM (SELECT "provider", "providerRefundId" FROM "RefundExecutionAttempt" WHERE "providerRefundId" IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1) x`],
  ["unknown attempts have no completion", `SELECT COUNT(*)::int AS count FROM "RefundExecutionAttempt" a JOIN "PaymentRefund" r ON r."id" = a."refundId" WHERE a."status"::text = 'UNKNOWN' AND r."completionLedgerJournalId" IS NOT NULL`],
  ["provider fees absent", `SELECT COUNT(*)::int AS count FROM "LedgerEntry" e JOIN "LedgerJournal" j ON j."id" = e."journalId" WHERE j."type"::text LIKE 'REFUND_%' AND lower(e."lineCode") LIKE '%fee%'`],
  ["raw banking data absent", `SELECT COUNT(*)::int AS count FROM "PaymentRefund" r WHERE COALESCE(r."customerNote", '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)' OR COALESCE(r."financeNote", '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)' OR EXISTS (SELECT 1 FROM "RefundExecutionAttempt" a WHERE a."refundId" = r."id" AND (COALESCE(a."safeRequestSnapshot"::text, '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)' OR COALESCE(a."safeResultSnapshot"::text, '') ~* '(account[ _-]*(number|no)|branch[ _-]*code|card[ _-]*number|cvv|cvc|iban|swift)'))`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = Number(rows[0]?.count ?? 0); console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`); if (count) failures.push(name); }
  const sources = await Promise.all(["refund-request.service.ts", "refund-wallet-completion.service.ts", "refund-provider-execution.service.ts"].map((file) => readFile(new URL(`../lib/services/${file}`, import.meta.url), "utf8")));
  const joined = sources.join("\n");
  if (/\b(?:tx\.)?(?:order)\.(?:update|updateMany|upsert|delete)/.test(joined)) failures.push("refund service mutates Order status");
  if (/\b(?:tx\.)?payment\.(?:update|updateMany)[\s\S]{0,240}\bstatus\s*:/.test(joined)) failures.push("refund service mutates Payment status");
  if (/availableBalance|pendingBalance|lockedBalance/.test(joined)) failures.push("refund service directly mutates legacy wallet balances");
  if (/provider[_ -]?fee|refund[_ -]?fee/i.test(joined)) failures.push("refund service posts provider fees");
  const readiness = await readFile(new URL("../lib/refunds/refund-production-readiness.ts", import.meta.url), "utf8");
  if (!/REFUND_PRODUCTION_VALIDATION_APPROVED\s*=\s*false/.test(readiness)) failures.push("production refund lock is not source-false");
  if (failures.length) throw new Error(`Refund invariant verification failed: ${failures.join("; ")}.`);
  console.log("Refund invariant verification passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Refund invariant verification failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
