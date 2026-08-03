import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["earnings are positive ZAR with exact arithmetic", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "currency"::text <> 'ZAR' OR "amount" <= 0 OR "settlementBasisAmount" - "attributedCommissionAmount" <> "amount"`],
  ["commission charge sum equals attributed commission", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE e."attributedCommissionAmount" <> COALESCE((SELECT SUM(c."amount") FROM "StoreEarningCommissionCharge" c WHERE c."storeEarningId" = e."id"), 0)`],
  ["commission attribution projection is exact and bounded", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" a WHERE a."storeAttributedAmount" > a."amount" OR a."storeAttributedAmount" <> COALESCE((SELECT SUM(c."amount") FROM "StoreEarningCommissionCharge" c WHERE c."commissionAllocationId" = a."id"), 0)`],
  ["every earning has one accrual journal", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e LEFT JOIN "LedgerJournal" j ON j."id" = e."accrualLedgerJournalId" WHERE j."id" IS NULL OR j."type"::text <> 'STORE_EARNING_ACCRUAL' OR j."totalDebits" <> e."amount" OR j."totalCredits" <> e."amount"`],
  ["accrual debits customer funds held", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE NOT EXISTS (SELECT 1 FROM "LedgerEntry" le JOIN "LedgerAccount" a ON a."id" = le."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE le."journalId" = e."accrualLedgerJournalId" AND le."direction"::text = 'DEBIT' AND le."amount" = e."amount" AND a."purpose"::text = 'HELD' AND w."ownerType"::text = 'PLATFORM')`],
  ["accrual credits store earnings payable", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."journalId" = e."accrualLedgerJournalId" AND le."direction"::text = 'CREDIT' AND le."amount" = e."amount" AND le."accountId" = e."payableAccountId")`],
  ["accrual moves no cash or owner withdrawable", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e JOIN "LedgerEntry" le ON le."journalId" = e."accrualLedgerJournalId" JOIN "LedgerAccount" a ON a."id" = le."accountId" WHERE a."purpose"::text IN ('CASH_CLEARING','OWNER_WITHDRAWABLE')`],
  ["projections do not exceed earning", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "refundReservedAmount" < 0 OR "refundedAmount" < 0 OR "releasedAmount" < 0 OR "reversedAmount" < 0 OR "refundReservedAmount" + "refundedAmount" + "releasedAmount" + "reversedAmount" > "amount"`],
  ["refund reserved projection matches active allocations", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE e."refundReservedAmount" <> COALESCE((SELECT SUM(f."amount") FROM "RefundFundingAllocation" f JOIN "PaymentRefund" r ON r."id" = f."refundId" WHERE f."storeEarningId" = e."id" AND r."status"::text IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','RECONCILIATION_REQUIRED')), 0)`],
  ["refunded projection matches successful allocations", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE e."refundedAmount" <> COALESCE((SELECT SUM(f."amount") FROM "RefundFundingAllocation" f JOIN "PaymentRefund" r ON r."id" = f."refundId" WHERE f."storeEarningId" = e."id" AND r."status"::text = 'SUCCEEDED'), 0)`],
  ["released earning has exact release journal", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e LEFT JOIN "LedgerJournal" j ON j."id" = e."releaseLedgerJournalId" WHERE e."status"::text = 'RELEASED' AND (j."id" IS NULL OR j."type"::text <> 'STORE_EARNING_RELEASE' OR j."totalDebits" <> e."releasedAmount" OR j."totalCredits" <> e."releasedAmount" OR e."refundReservedAmount" <> 0)`],
  ["release debits payable and credits owner withdrawable", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE e."status"::text = 'RELEASED' AND (NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."journalId" = e."releaseLedgerJournalId" AND le."accountId" = e."payableAccountId" AND le."direction"::text = 'DEBIT' AND le."amount" = e."releasedAmount") OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" le JOIN "LedgerAccount" a ON a."id" = le."accountId" WHERE le."journalId" = e."releaseLedgerJournalId" AND le."direction"::text = 'CREDIT' AND le."amount" = e."releasedAmount" AND a."walletId" = e."walletId" AND a."purpose"::text = 'OWNER_WITHDRAWABLE'))`],
  ["release moves no cash", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e JOIN "LedgerEntry" le ON le."journalId" = e."releaseLedgerJournalId" JOIN "LedgerAccount" a ON a."id" = le."accountId" WHERE a."purpose"::text = 'CASH_CLEARING'`],
  ["reversed earning has exact reversal journal", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e LEFT JOIN "LedgerJournal" j ON j."id" = e."reversalLedgerJournalId" WHERE e."status"::text = 'REVERSED' AND (j."id" IS NULL OR j."type"::text <> 'STORE_EARNING_REVERSAL' OR j."totalDebits" <> e."reversedAmount" OR j."totalCredits" <> e."reversedAmount")`],
  ["reversal debits payable and credits customer held", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e WHERE e."status"::text = 'REVERSED' AND (NOT EXISTS (SELECT 1 FROM "LedgerEntry" le WHERE le."journalId" = e."reversalLedgerJournalId" AND le."accountId" = e."payableAccountId" AND le."direction"::text = 'DEBIT' AND le."amount" = e."reversedAmount") OR NOT EXISTS (SELECT 1 FROM "LedgerEntry" le JOIN "LedgerAccount" a ON a."id" = le."accountId" WHERE le."journalId" = e."reversalLedgerJournalId" AND le."direction"::text = 'CREDIT' AND le."amount" = e."reversedAmount" AND a."purpose"::text = 'HELD'))`],
  ["release and reversal never coexist", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "releaseLedgerJournalId" IS NOT NULL AND "reversalLedgerJournalId" IS NOT NULL`],
  ["fully refunded earnings are exact", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "status"::text = 'FULLY_REFUNDED' AND ("refundedAmount" <> "amount" OR "releasedAmount" <> 0 OR "reversedAmount" <> 0)`],
  ["released earnings never fund refunds", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e JOIN "RefundFundingAllocation" f ON f."storeEarningId" = e."id" JOIN "PaymentRefund" r ON r."id" = f."refundId" WHERE e."status"::text = 'RELEASED' AND r."status"::text NOT IN ('CANCELLED','REJECTED')`],
];

async function main() {
  const failures = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = Number(rows[0]?.count ?? 0); console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`); if (count) failures.push(name); }
  const serviceFiles = ["store-earning-accrual.service.ts", "store-earning-release.service.ts", "store-earning-reversal.service.ts", "store-earning-refund.service.ts"];
  const sources = (await Promise.all(serviceFiles.map((file) => readFile(new URL(`../lib/services/${file}`, import.meta.url), "utf8")))).join("\n");
  if (/\b(?:tx\.)?order\.(?:update|updateMany|upsert|delete)/.test(sources)) failures.push("store earning service mutates Order");
  if (/\b(?:tx\.)?payment\.(?:update|updateMany|upsert|delete)/.test(sources)) failures.push("store earning service mutates Payment");
  if (/driver(?:Profile|Earning)|DRIVER_EARNING/.test(sources)) failures.push("store earning service contains driver earnings");
  if (/\b(?:Number|parseFloat|Math\.round)\b|\.toFixed\s*\(/.test(sources)) failures.push("store earning service contains prohibited floating-point financial calculation");
  const readiness = await readFile(new URL("../lib/store-earnings/store-earning-production-readiness.ts", import.meta.url), "utf8");
  if (!/STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED\s*=\s*false/.test(readiness)) failures.push("production store earning lock is not source-false");
  if (failures.length) throw new Error(`Store earning invariant verification failed: ${failures.join("; ")}.`);
  console.log("Store earning invariant verification passed.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Store earning invariant verification failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
