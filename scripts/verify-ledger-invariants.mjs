import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const checks = [
  {
    name: "journals have at least two entries",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerJournal" j WHERE (SELECT COUNT(*) FROM "LedgerEntry" e WHERE e."journalId" = j."id") < 2`,
  },
  {
    name: "journal debit and credit evidence is balanced",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerJournal" j
      LEFT JOIN "LedgerEntry" e ON e."journalId" = j."id"
      GROUP BY j."id"
      HAVING COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'DEBIT'), 0)
        <> COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'CREDIT'), 0)
        OR COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'DEBIT'), 0) <> MAX(j."totalDebits")
        OR COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'CREDIT'), 0) <> MAX(j."totalCredits")
    `,
    rowsAreFailures: true,
  },
  {
    name: "entry amounts are positive",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerEntry" WHERE "amount" <= 0`,
  },
  {
    name: "journal and account currencies agree",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerEntry" e
      JOIN "LedgerJournal" j ON j."id" = e."journalId"
      JOIN "LedgerAccount" a ON a."id" = e."accountId"
      WHERE j."currency"::text <> a."currency"::text
    `,
  },
  {
    name: "account current balance projections match entries",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerAccount" a
      LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
      GROUP BY a."id"
      HAVING a."currentBalance" <>
        CASE WHEN a."category" IN ('ASSET', 'EXPENSE')
          THEN COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'DEBIT'), 0)
             - COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'CREDIT'), 0)
          ELSE COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'CREDIT'), 0)
             - COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'DEBIT'), 0)
        END
    `,
    rowsAreFailures: true,
  },
  {
    name: "account debit totals match entries",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerAccount" a
      LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
      GROUP BY a."id"
      HAVING a."debitTotal" <> COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'DEBIT'), 0)
    `,
    rowsAreFailures: true,
  },
  {
    name: "account credit totals match entries",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerAccount" a
      LEFT JOIN "LedgerEntry" e ON e."accountId" = a."id"
      GROUP BY a."id"
      HAVING a."creditTotal" <> COALESCE(SUM(e."amount") FILTER (WHERE e."direction" = 'CREDIT'), 0)
    `,
    rowsAreFailures: true,
  },
  {
    name: "non-negative accounts are not negative",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerAccount" WHERE NOT "allowNegative" AND "currentBalance" < 0`,
  },
  {
    name: "idempotency keys are unique",
    sql: `SELECT COUNT(*)::int AS count FROM (SELECT "idempotencyKey" FROM "LedgerJournal" GROUP BY "idempotencyKey" HAVING COUNT(*) > 1) duplicate_keys`,
  },
  {
    name: "request hashes exist",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE length("requestHash") <> 64`,
  },
  {
    name: "reversal journals reference an original",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerJournal" reversal WHERE reversal."type" = 'REVERSAL' AND reversal."reversalOfJournalId" IS NULL`,
  },
  {
    name: "original journals have at most one direct reversal",
    sql: `SELECT COUNT(*)::int AS count FROM (SELECT "reversalOfJournalId" FROM "LedgerJournal" WHERE "reversalOfJournalId" IS NOT NULL GROUP BY "reversalOfJournalId" HAVING COUNT(*) > 1) duplicate_reversals`,
  },
  {
    name: "reversal entries exactly invert originals",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM "LedgerJournal" reversal
      WHERE reversal."reversalOfJournalId" IS NOT NULL
        AND (
          (SELECT COUNT(*) FROM "LedgerEntry" WHERE "journalId" = reversal."id")
            <> (SELECT COUNT(*) FROM "LedgerEntry" WHERE "journalId" = reversal."reversalOfJournalId")
          OR EXISTS (
            SELECT 1
            FROM "LedgerEntry" original_entry
            WHERE original_entry."journalId" = reversal."reversalOfJournalId"
              AND NOT EXISTS (
                SELECT 1
                FROM "LedgerEntry" reversal_entry
                WHERE reversal_entry."journalId" = reversal."id"
                  AND reversal_entry."sequence" = original_entry."sequence"
                  AND reversal_entry."accountId" = original_entry."accountId"
                  AND reversal_entry."amount" = original_entry."amount"
                  AND reversal_entry."direction" = CASE original_entry."direction"
                    WHEN 'DEBIT' THEN 'CREDIT'::"LedgerEntryDirection"
                    ELSE 'DEBIT'::"LedgerEntryDirection"
                  END
              )
          )
        )
    `,
  },
  {
    name: "journals do not reverse themselves",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerJournal" WHERE "id" = "reversalOfJournalId"`,
  },
  {
    name: "logical wallets are unique",
    sql: `SELECT COUNT(*)::int AS count FROM (SELECT "ownerType", "ownerId", "currency" FROM "Wallet" GROUP BY "ownerType", "ownerId", "currency" HAVING COUNT(*) > 1) duplicate_wallets`,
  },
  {
    name: "wallet account purposes are unique",
    sql: `SELECT COUNT(*)::int AS count FROM (SELECT "walletId", "purpose", "currency" FROM "LedgerAccount" GROUP BY "walletId", "purpose", "currency" HAVING COUNT(*) > 1) duplicate_accounts`,
  },
  {
    name: "entries are not orphaned",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerEntry" e LEFT JOIN "LedgerJournal" j ON j."id" = e."journalId" LEFT JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE j."id" IS NULL OR a."id" IS NULL`,
  },
  {
    name: "accounts are not orphaned",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerAccount" a LEFT JOIN "Wallet" w ON w."id" = a."walletId" WHERE w."id" IS NULL`,
  },
  {
    name: "non-zero accounts have ledger evidence",
    sql: `SELECT COUNT(*)::int AS count FROM "LedgerAccount" a WHERE a."currentBalance" <> 0 AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."accountId" = a."id")`,
  },
];

function failureCount(rows, rowsAreFailures = false) {
  if (rowsAreFailures) return rows.length;
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const failures = [];
  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe(check.sql);
    const count = failureCount(rows, check.rowsAreFailures);
    console.log(`${count === 0 ? "PASS" : "FAIL"}: ${check.name}${count === 0 ? "" : ` (${count})`}`);
    if (count > 0) failures.push(check.name);
  }

  const deliverySource = await readFile(new URL("../lib/services/delivery-execution.service.ts", import.meta.url), "utf8");
  const directLedgerIntegration = /ledger(?:Journal|Entry|Account)|postLedgerJournal|reverseLedgerJournal/i.test(deliverySource);
  console.log(`${directLedgerIntegration ? "FAIL" : "PASS"}: no Phase 8 delivery-to-ledger integration`);
  if (directLedgerIntegration) failures.push("no Phase 8 delivery-to-ledger integration");

  if (failures.length > 0) {
    throw new Error(`Ledger invariant verification failed: ${failures.join("; ")}.`);
  }
  console.log("Ledger invariant verification passed.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Ledger invariant verification failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
