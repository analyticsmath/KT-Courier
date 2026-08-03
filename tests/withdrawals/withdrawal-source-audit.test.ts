import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(path.join(root, "prisma", "migrations", "20260717050000_phase13_withdrawals_finance_admin", "migration.sql"), "utf8");
const withdrawalServiceSource = [
  "withdrawal-request.service.ts",
  "withdrawal-finance-review.service.ts",
  "withdrawal-payout.service.ts",
  "withdrawal-query.service.ts",
].map((file) => readFileSync(path.join(root, "lib", "services", file), "utf8")).join("\n");
const dbTypes = readFileSync(path.join(root, "types", "db.ts"), "utf8");
const withdrawalContractSource = [
  readFileSync(path.join(root, "lib", "dto", "withdrawal.dto.ts"), "utf8"),
  readFileSync(path.join(root, "lib", "validation", "withdrawals.ts"), "utf8"),
  ...readSourceTree(path.join(root, "app", "api", "withdrawals")),
  ...readSourceTree(path.join(root, "app", "api", "admin", "withdrawals")),
].join("\n");
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

function modelBlock(name: string): string {
  const match = new RegExp(`model\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match) throw new Error(`Model not found: ${name}`);
  return match[1];
}

function migrationTableBlock(name: string): string {
  const match = new RegExp(`CREATE\\s+TABLE\\s+"${name}"\\s+\\(([\\s\\S]*?)\\n\\);`, "i").exec(migration);
  if (!match) throw new Error(`Migration table not found: ${name}`);
  return match[1];
}

function readSourceTree(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readSourceTree(entryPath);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [readFileSync(entryPath, "utf8")] : [];
  });
}

describe("withdrawal source audit", () => {
  it("keeps active withdrawals destination-backed and never reads or writes legacy compatibility fields", () => {
    expect(modelBlock("WithdrawalRequest")).toMatch(/payoutDestinationId\s+String/);
    expect(withdrawalServiceSource).toMatch(/withdrawal\.payoutDestination/);
    expect(withdrawalServiceSource).not.toMatch(new RegExp(`\\bwithdrawal\\.(?:${legacyCompatibilityColumns.join("|")})\\b`));
    expect(withdrawalServiceSource).not.toMatch(new RegExp(`withdrawalRequest\\.(?:create|update|updateMany|upsert)[\\s\\S]{0,2000}?\\b(?:${legacyCompatibilityColumns.join("|")})\\s*:`, "m"));
    expect(dbTypes).not.toMatch(/legacy(?:ReviewedByUserId|BankName|AccountHolder|AccountLast4|RejectionReason|Metadata|ReviewedAt|PaidAt)/);
  });

  it("keeps legacy compatibility fields out of withdrawal validators, DTOs, and API contracts", () => {
    expect(withdrawalContractSource).not.toMatch(/\blegacy(?:ReviewedByUserId|BankName|AccountHolder|AccountLast4|RejectionReason|Metadata|ReviewedAt|PaidAt)\b/);
    expect(withdrawalContractSource).not.toMatch(/\b(?:bankName|accountHolder)\b/);
    expect(withdrawalContractSource).not.toMatch(/\b(?:reviewedByUserId|rejectionReason|metadata|reviewedAt|paidAt)\b/);
  });

  it("retains legacy compatibility columns without migrating their contents into a payout destination", () => {
    for (const column of legacyCompatibilityColumns) {
      expect(migration).not.toMatch(new RegExp(`DROP\\s+COLUMN\\s+"${column}"`, "i"));
      expect(migration).not.toMatch(new RegExp(`RENAME\\s+COLUMN\\s+"${column}"`, "i"));
      expect(migration).toMatch(new RegExp(`"${column}"\\s+IS\\s+NULL`, "i"));
    }
    expect(migration).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE)\s+"PayoutDestination"\b/i);
    expect(migrationTableBlock("PayoutDestination")).not.toMatch(/\b(?:bankName|accountHolder)\b/i);
  });

  it("does not introduce a full account-number field in Phase 13 payout models", () => {
    const payoutDestination = modelBlock("PayoutDestination");
    expect(payoutDestination).toMatch(/externalReference\s+String/);
    expect(payoutDestination).toMatch(/maskedLabel\s+String/);
    expect(payoutDestination).not.toMatch(/^\s*(?:accountNumber|bankAccountNumber|iban|routingNumber|sortCode)\s+/mi);
  });
});
