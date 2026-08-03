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
  ["legacy withdrawal placeholder rows", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest"`],
  ["legacy withdrawal compatibility columns missing", `SELECT COUNT(*)::int AS count FROM (VALUES ${compatibilityColumnValues}) AS expected(column_name) LEFT JOIN information_schema.columns actual ON actual.table_schema = 'public' AND actual.table_name = 'WithdrawalRequest' AND actual.column_name = expected.column_name WHERE actual.column_name IS NULL`],
  ["legacy withdrawal compatibility values", `SELECT COUNT(*)::int AS count FROM "WithdrawalRequest" WHERE "reviewedByUserId" IS NOT NULL OR "bankName" IS NOT NULL OR "accountHolder" IS NOT NULL OR "accountLast4" IS NOT NULL OR "rejectionReason" IS NOT NULL OR "metadata" IS NOT NULL OR "reviewedAt" IS NOT NULL OR "paidAt" IS NOT NULL`],
];

async function main() {
  const blockers = [];
  for (const [name, sql] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql); const count = rows.reduce((total, row) => total + Number(row.count ?? 0), 0);
    console.log(`${count ? "BLOCK" : "CLEAR"}: ${name}${count ? ` (${count})` : ""}`);
    if (count) blockers.push(name);
  }
  if (blockers.length) throw new Error(`Phase 13 withdrawal preflight blocked: ${blockers.join("; ")}.`);
  console.log("Phase 13 withdrawal preflight passed.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : "Phase 13 withdrawal preflight failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
