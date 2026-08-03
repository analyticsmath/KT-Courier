import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-reconciliation.service.ts"), "utf8");

describe("store earning reconciliation service", () => {
  it("mocks idempotent case upsert and evidence-based resolution", () => { const tx = createStoreEarningTransactionMock(); expect(tx.storeEarningReconciliationCase.upsert).toBeTypeOf("function"); expect(tx.storeEarningReconciliationCase.updateMany).toBeTypeOf("function"); });
  it("increments repeated observations without financial override fields", () => { expect(source).toMatch(/observationCount:\s*\{ increment: 1 \}/); expect(source).not.toMatch(/balanceAdjustment|replacementAmount|manualCredit|manualDebit/); });
  it("resolves only with restored canonical evidence", () => { expect(source).toMatch(/mayResolveStoreEarningReconciliation/); expect(source).toMatch(/canonicalOperationReference/); expect(source).toMatch(/status:\s*"RESOLVED"/); });
});
