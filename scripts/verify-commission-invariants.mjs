import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["accrual totals equal allocations", `SELECT COUNT(*)::int AS count FROM "CommissionAccrual" a WHERE a."totalAmount" <> COALESCE((SELECT SUM(x."amount") FROM "CommissionAllocation" x WHERE x."accrualId" = a."id"), 0)`],
  ["commission allocations are positive ZAR", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" WHERE "amount" <= 0 OR "currency"::text <> 'ZAR'`],
  ["accrual journals are coherent", `SELECT COUNT(*)::int AS count FROM "CommissionAccrual" a JOIN "LedgerJournal" j ON j."id" = a."ledgerJournalId" WHERE a."status"::text IN ('ACCRUED','RECONCILIATION_REQUIRED') AND (j."type"::text <> 'COMMISSION_ACCRUAL' OR j."totalDebits" <> a."totalAmount" OR j."totalCredits" <> a."totalAmount")`],
  ["reversal journals are coherent", `SELECT COUNT(*)::int AS count FROM "CommissionAccrual" a JOIN "LedgerJournal" j ON j."id" = a."reversalLedgerJournalId" WHERE a."status"::text = 'REVERSED' AND (j."type"::text <> 'COMMISSION_REVERSAL' OR j."reversalOfJournalId" <> a."ledgerJournalId")`],
  ["commission journals touch cash clearing", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" j JOIN "LedgerEntry" e ON e."journalId" = j."id" JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE j."type"::text IN ('COMMISSION_ACCRUAL','COMMISSION_REVERSAL') AND a."purpose"::text IN ('CASH_CLEARING','OWNER_WITHDRAWABLE')`],
  ["platform allocation account mismatch", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" x JOIN "LedgerAccount" a ON a."id" = x."ledgerAccountId" WHERE x."allocationType"::text = 'PLATFORM_COMMISSION_REVENUE' AND (a."purpose"::text <> 'PLATFORM_REVENUE' OR a."category"::text <> 'REVENUE')`],
  ["beneficiary allocation account mismatch", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" x JOIN "LedgerAccount" a ON a."id" = x."ledgerAccountId" WHERE x."allocationType"::text = 'BENEFICIARY_COMMISSION_PAYABLE' AND (a."purpose"::text <> 'COMMISSION_PAYABLE' OR a."category"::text <> 'LIABILITY')`],
];
async function main() {
  const failures = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = Number(rows[0]?.count ?? 0); console.log(`${count ? "FAIL" : "PASS"}: ${name}${count ? ` (${count})` : ""}`); if (count) failures.push(name); }
  const source = await Promise.all(["commission-accrual.service.ts", "commission-reversal.service.ts", "commission-preview.service.ts"].map((file) => readFile(new URL(`../lib/services/${file}`, import.meta.url), "utf8")));
  if (/\b(?:tx\.)?(?:order|payment|paymentAttempt|walletTransaction)\.(?:create|update|updateMany|upsert|delete)/.test(source.join("\n"))) failures.push("commission services cross module boundary");
  if (failures.length) throw new Error(`Commission invariant verification failed: ${failures.join("; ")}.`);
  console.log("Commission invariant verification passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Commission invariant verification failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
