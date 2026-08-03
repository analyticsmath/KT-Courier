import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function countOf(rows) {
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const [
    walletCountRows,
    walletsByCurrency,
    walletsByStatus,
    nonZeroRows,
    legacyTransactionRows,
    duplicateRows,
    invalidOwnerRows,
  ] = await Promise.all([
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Wallet"`,
    prisma.$queryRaw`SELECT "currency", COUNT(*)::int AS count FROM "Wallet" GROUP BY "currency" ORDER BY "currency"`,
    prisma.$queryRaw`SELECT "status"::text AS status, COUNT(*)::int AS count FROM "Wallet" GROUP BY "status" ORDER BY "status"`,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "Wallet"
      WHERE "availableBalance" <> 0 OR "pendingBalance" <> 0 OR "lockedBalance" <> 0
    `,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "WalletTransaction"`,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT "ownerType", "ownerId", "currency"
        FROM "Wallet"
        GROUP BY "ownerType", "ownerId", "currency"
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "Wallet" wallet
      WHERE
        (wallet."ownerType" = 'CUSTOMER' AND NOT EXISTS (
          SELECT 1 FROM "User" owner_record
          WHERE owner_record."id" = wallet."ownerId" AND owner_record."role" = 'CUSTOMER'
        ))
        OR (wallet."ownerType" = 'STORE' AND NOT EXISTS (
          SELECT 1 FROM "Store" owner_record WHERE owner_record."id" = wallet."ownerId"
        ))
        OR (wallet."ownerType" = 'DRIVER' AND NOT EXISTS (
          SELECT 1 FROM "DriverProfile" owner_record WHERE owner_record."id" = wallet."ownerId"
        ))
        OR (wallet."ownerType" = 'PROMOTER' AND NOT EXISTS (
          SELECT 1 FROM "PromoterProfile" owner_record WHERE owner_record."id" = wallet."ownerId"
        ))
        OR (wallet."ownerType" = 'PLATFORM' AND wallet."ownerId" <> 'platform')
    `,
  ]);

  const walletCount = countOf(walletCountRows);
  const nonZeroWallets = countOf(nonZeroRows);
  const legacyTransactions = countOf(legacyTransactionRows);
  const duplicates = countOf(duplicateRows);
  const invalidOwners = countOf(invalidOwnerRows);
  const unsupportedCurrencies = walletsByCurrency
    .filter((row) => row.currency !== "ZAR")
    .reduce((total, row) => total + Number(row.count), 0);

  console.log(`Phase 9 ledger preflight: ${walletCount} wallet(s).`);
  console.log("Wallet currency counts:", walletsByCurrency);
  console.log("Wallet status counts:", walletsByStatus);
  console.log(`Non-zero legacy wallets: ${nonZeroWallets}.`);
  console.log(`Legacy wallet transactions: ${legacyTransactions}.`);
  console.log(`Duplicate logical wallets: ${duplicates}.`);
  console.log(`Invalid wallet owners: ${invalidOwners}.`);

  const blockers = [];
  if (nonZeroWallets > 0) blockers.push("non-zero legacy balances require balanced opening evidence");
  if (legacyTransactions > 0) blockers.push("legacy wallet transactions require explicit reconciliation");
  if (duplicates > 0) blockers.push("duplicate logical wallets exist");
  if (invalidOwners > 0) blockers.push("wallet owner references are invalid");
  if (unsupportedCurrencies > 0) blockers.push("non-ZAR wallets are unsupported in Phase 9");

  if (blockers.length > 0) {
    throw new Error(`Phase 9 migration is unsafe: ${blockers.join("; ")}.`);
  }

  console.log("Phase 9 ledger preflight passed.");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Phase 9 ledger preflight failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
