import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ledger evidence immutability source audit", () => {
  it("contains no runtime update or delete operation for journals or entries", () => {
    const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return collect(file);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
    });
    const files = [path.join(process.cwd(), "app"), path.join(process.cwd(), "lib")].flatMap(collect);
    const runtimeSource = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(runtimeSource).not.toMatch(/ledgerJournal\.(?:update|updateMany|delete|deleteMany)\s*\(/);
    expect(runtimeSource).not.toMatch(/ledgerEntry\.(?:update|updateMany|delete|deleteMany)\s*\(/);
    expect(runtimeSource).not.toMatch(/walletTransaction\.(?:create|createMany|upsert)\s*\(/);
  });

  it("does not wire delivery execution into the ledger", () => {
    const delivery = readFileSync(path.join(process.cwd(), "lib/services/delivery-execution.service.ts"), "utf8");
    expect(delivery).not.toMatch(/postLedgerJournal|ledgerJournal|ledgerEntry/i);
  });
});
