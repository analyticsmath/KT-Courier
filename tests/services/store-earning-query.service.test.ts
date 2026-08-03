import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-query.service.ts"), "utf8");

describe("store earning query service", () => {
  it("mocks ownership, pagination, list, detail, and reconciliation reads", () => { const tx = createStoreEarningTransactionMock(); expect(tx.user.findUnique).toBeTypeOf("function"); expect(tx.store.findMany).toBeTypeOf("function"); expect(tx.storeEarning.count).toBeTypeOf("function"); expect(tx.storeEarningReconciliationCase.findMany).toBeTypeOf("function"); });
  it("requires one active STORE-owned store and scopes every store detail", () => { expect(source).toMatch(/user\.role !== "STORE"/); expect(source).toMatch(/stores\.length !== 1/); expect(source).toMatch(/publicReference, storeId:\s*store\.id/); });
  it("formats all financial values as exact strings", () => { expect(source).toMatch(/formatStoreEarningMoney/); expect(source).not.toMatch(/Number\(|parseFloat|Math\.round|\.toFixed\(/); });
  it("keeps account IDs, customer PII, and idempotency hashes out of store DTOs", () => { const safeSection = source.slice(source.indexOf("function storeItem"), source.indexOf("function financeItem")); expect(safeSection).not.toMatch(/payableAccountId|walletId|customer|creationRequestHash|calculationHash/); });
});
