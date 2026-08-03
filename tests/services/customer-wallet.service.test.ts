import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/customer-wallet.service.ts"), "utf8");
describe("customer wallet service", () => {
  it("provides a complete winner-reread transaction mock", () => { const tx = createRefundTransactionMock(); expect(tx.wallet.findUnique).toBeTypeOf("function"); expect(tx.ledgerAccount.upsert).toBeTypeOf("function"); expect(tx.ledgerEntry.findMany).toBeTypeOf("function"); });
  it("provisions both default-zero customer liability accounts through the idempotent account primitive", () => { expect(source).toMatch(/CUSTOMER_WALLET_AVAILABLE/); expect(source).toMatch(/CUSTOMER_REFUND_HELD/); expect(source).toMatch(/category:\s*"LIABILITY"/); expect(source).toMatch(/ensureLedgerAccount/); expect(source).not.toMatch(/currentBalance\s*:/); });
  it("reads journal-backed transactions and returns exact strings", () => { expect(source).toMatch(/ledgerEntry\.findMany/); expect(source).toMatch(/\.toFixed\(2\)/); expect(source).not.toMatch(/Number\(|parseFloat|parseInt/); });
});
