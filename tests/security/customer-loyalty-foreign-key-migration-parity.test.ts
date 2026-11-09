import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Once deployed, migration-defined PostgreSQL constraint names are immutable
 * historical state. Prisma must map its model relations to those names, not
 * silently request "rename foreign key" drift on a fresh database.
 */
describe("customer loyalty migration / Prisma foreign-key parity", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migrationFiles = [
    "prisma/migrations/20261108072000_customer_loyalty_ledger/migration.sql",
    "prisma/migrations/20261108080000_customer_loyalty_wallet_redemption/migration.sql",
  ];
  const migration = migrationFiles.map(path => readFileSync(path, "utf8")).join("\n");
  const expected = [
    ["CustomerLoyaltyEarning", "account", "CustomerLoyaltyEarning_account_fkey", "userId"],
    ["CustomerLoyaltyEarning", "payment", "CustomerLoyaltyEarning_payment_fkey", "paymentId"],
    ["CustomerLoyaltyMovement", "account", "CustomerLoyaltyMovement_account_fkey", "userId"],
    ["CustomerLoyaltyMovement", "earning", "CustomerLoyaltyMovement_earning_fkey", "paymentId"],
    ["CustomerLoyaltyRedemption", "account", "CustomerLoyaltyRedemption_account_fkey", "userId"],
    ["CustomerLoyaltyRedemption", "journal", "CustomerLoyaltyRedemption_journal_fkey", "journalId"],
  ] as const;

  for (const [model, relation, constraint, column] of expected) {
    it(`preserves ${model}.${relation} as ${constraint}`, () => {
      const body = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1];
      expect(body, `Prisma model ${model} is missing`).toBeDefined();
      const line = body!.split("\n").find(l => l.trimStart().startsWith(`${relation} `));
      expect(line).toContain(`fields: [${column}]`);
      expect(line).toContain(`map: "${constraint}"`);
      expect(migration).toContain(`CONSTRAINT "${constraint}"`);
      expect(migration).toMatch(new RegExp(`CONSTRAINT "${constraint}"\\s+FOREIGN KEY \\("${column}"\\)`));
    });
  }
});
