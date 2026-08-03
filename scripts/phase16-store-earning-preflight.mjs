import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const blockers = [];

async function scalar(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.count ?? 0);
}

async function tableExists(name) {
  return Boolean(await scalar(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '${name.replaceAll("'", "''")}'`));
}

async function columnExists(table, column) {
  return Boolean(await scalar(`SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${table.replaceAll("'", "''")}' AND column_name = '${column.replaceAll("'", "''")}'`));
}

async function check(name, sql) {
  const count = await scalar(sql);
  console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`);
  if (count) blockers.push(name);
}

async function main() {
  await check("unsupported legacy store earning placeholders", `SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = current_schema() AND lower(table_name) ~ '(store|seller).*(earning|settlement)' AND table_name NOT IN ('StoreEarning','StoreEarningCommissionCharge','StoreEarningStatusHistory','StoreEarningReconciliationCase')`);
  await check("invalid STORE wallets", `SELECT COUNT(*)::int AS count FROM "Wallet" w LEFT JOIN "Store" s ON s."id" = w."ownerId" WHERE w."ownerType"::text = 'STORE' AND (s."id" IS NULL OR w."currency" <> 'ZAR')`);
  await check("missing customer-funds-held account", `SELECT CASE WHEN EXISTS (SELECT 1 FROM "LedgerAccount" a JOIN "Wallet" w ON w."id" = a."walletId" WHERE a."purpose"::text = 'HELD' AND a."category"::text = 'LIABILITY' AND a."currency"::text = 'ZAR' AND w."ownerType"::text = 'PLATFORM' AND w."ownerId" = 'platform') THEN 0 ELSE 1 END::int AS count`);
  await check("existing store earning journals without Phase 16 aggregate", `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "type"::text LIKE 'STORE_EARNING_%'`);
  if (await tableExists("StoreEarning")) {
    await check("duplicate settlement identities", `SELECT COUNT(*)::int AS count FROM (SELECT "subjectType", "subjectId", "storeId", "settlementVersion" FROM "StoreEarning" GROUP BY 1,2,3,4 HAVING COUNT(*) > 1) x`);
    await check("non-ZAR or non-positive store earnings", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "currency"::text <> 'ZAR' OR "amount" <= 0 OR "settlementBasisAmount" - "attributedCommissionAmount" <> "amount"`);
    await check("invalid store payable ownership", `SELECT COUNT(*)::int AS count FROM "StoreEarning" e JOIN "LedgerAccount" a ON a."id" = e."payableAccountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE a."walletId" <> e."walletId" OR w."ownerType"::text <> 'STORE' OR w."ownerId" <> e."storeId" OR a."purpose"::text <> 'STORE_EARNINGS_PAYABLE' OR a."category"::text <> 'LIABILITY' OR a."allowNegative"`);
    await check("release and reversal conflicts", `SELECT COUNT(*)::int AS count FROM "StoreEarning" WHERE "releaseLedgerJournalId" IS NOT NULL AND "reversalLedgerJournalId" IS NOT NULL`);
  }
  if (await columnExists("CommissionAllocation", "storeAttributedAmount")) await check("over-attributed commission allocations", `SELECT COUNT(*)::int AS count FROM "CommissionAllocation" WHERE "storeAttributedAmount" < 0 OR "storeAttributedAmount" > "amount"`);
  if (await columnExists("RefundFundingAllocation", "storeEarningId")) await check("invalid store earning refund funding links", `SELECT COUNT(*)::int AS count FROM "RefundFundingAllocation" WHERE ("sourceType"::text = 'STORE_EARNINGS_PAYABLE') <> ("storeEarningId" IS NOT NULL)`);
  if (blockers.length) throw new Error(`Phase 16 store earning preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 16 store earning preflight passed.");
}

try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Phase 16 store earning preflight failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
