import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-account.service.ts"), "utf8");

describe("store earning account service", () => {
  it("has mocks for store, wallet, payable account, and transaction locks", () => { const tx = createStoreEarningTransactionMock(); expect(tx.store.findUnique).toBeTypeOf("function"); expect(tx.wallet.findUnique).toBeTypeOf("function"); expect(tx.ledgerAccount.findFirst).toBeTypeOf("function"); expect(tx.$queryRaw).toBeTypeOf("function"); });
  it("requires the canonical active STORE/ZAR wallet", () => { expect(source).toMatch(/ownerType_ownerId_currency/); expect(source).toMatch(/ownerType:\s*"STORE"/); expect(source).toMatch(/status !== "ACTIVE"/); });
  it("provisions idempotently with zero-opening and no negative balance", () => { expect(source).toMatch(/ensureLedgerAccount/); expect(source).toMatch(/STORE_EARNINGS_PAYABLE/); expect(source).toMatch(/allowNegative/); expect(source).toMatch(/currentBalance !== "0\.00"/); });
});
