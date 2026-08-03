import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checks = [
  ["legacy commission placeholder rows", `SELECT COUNT(*)::int AS count FROM "CommissionRule" UNION ALL SELECT COUNT(*)::int AS count FROM "CommissionTransaction"`],
  ["overlapping active policies", `SELECT COUNT(*)::int AS count FROM "CommissionPlan" a JOIN "CommissionPlan" b ON a."id" < b."id" AND a."status"::text = 'ACTIVE' AND b."status"::text = 'ACTIVE' AND a."subjectType" = b."subjectType" AND a."scopeKey" = b."scopeKey" AND a."currency" = b."currency" AND a."effectiveFrom" < COALESCE(b."effectiveUntil", 'infinity'::timestamp) AND b."effectiveFrom" < COALESCE(a."effectiveUntil", 'infinity'::timestamp)`],
  ["invalid policy rules", `SELECT COUNT(*)::int AS count FROM "CommissionPolicyRule" WHERE ("calculationMethod"::text = 'PERCENTAGE_BPS' AND ("rateBasisPoints" IS NULL OR "rateBasisPoints" < 0 OR "rateBasisPoints" > 10000 OR "fixedAmount" IS NOT NULL)) OR ("calculationMethod"::text = 'FIXED_AMOUNT' AND ("fixedAmount" IS NULL OR "fixedAmount" < 0 OR "rateBasisPoints" IS NOT NULL)) OR ("minimumAmount" IS NOT NULL AND "maximumAmount" IS NOT NULL AND "minimumAmount" > "maximumAmount")`],
  ["duplicate settlement accruals", `SELECT COUNT(*)::int AS count FROM (SELECT "subjectType", "subjectId", "settlementVersion" FROM "CommissionAccrual" GROUP BY 1,2,3 HAVING COUNT(*) > 1) duplicates`],
  ["missing platform commission accounts", `SELECT CASE WHEN EXISTS (SELECT 1 FROM "LedgerAccount" a JOIN "Wallet" w ON w."id" = a."walletId" WHERE w."ownerType"::text = 'PLATFORM' AND w."ownerId" = 'platform' AND a."purpose"::text = 'PLATFORM_REVENUE' AND a."category"::text = 'REVENUE' AND a."currency"::text = 'ZAR') THEN 0 ELSE 1 END::int AS count`],
  ["commission payable account mismatch", `SELECT COUNT(*)::int AS count FROM "LedgerAccount" WHERE "purpose"::text = 'COMMISSION_PAYABLE' AND ("category"::text <> 'LIABILITY' OR "currency"::text <> 'ZAR')`],
];
async function main() {
  const blockers = [];
  for (const [name, sql] of checks) { const rows = await prisma.$queryRawUnsafe(sql); const count = rows.reduce((total, row) => total + Number(row.count ?? 0), 0); console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`); if (count) blockers.push(name); }
  if (blockers.length) throw new Error(`Phase 14 commission preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 14 commission preflight passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Phase 14 commission preflight failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
