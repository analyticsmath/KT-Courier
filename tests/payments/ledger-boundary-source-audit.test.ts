import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sources = ["lib/services/payment-preparation.service.ts", "lib/services/payment-provider-session.service.ts"].map((file) => readFileSync(file, "utf8")).join("\n");
describe("payment-to-ledger source boundary", () => {
  it.each(["postLedgerJournal", "transferBetweenLedgerAccounts", "reverseLedgerJournal"])("does not invoke %s", (operation) => expect(sources).not.toMatch(new RegExp(`\\b${operation}\\b`)));
  it("does not write ledger models or wallet projections", () => expect(sources).not.toMatch(/(?:ledgerJournal|ledgerEntry|ledgerAccount|walletTransaction)\.(?:create|update|upsert)/));
});

