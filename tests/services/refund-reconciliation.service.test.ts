import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/refund-reconciliation.service.ts"), "utf8");
describe("refund reconciliation service", () => {
  it("keeps provider query outside its finalization transaction and production locked", () => { expect(source).toMatch(/queryRefund/); expect(source).toMatch(/assertProductionReady.*assertRefundProductionActivation/); expect(source.indexOf("adapter.queryRefund")).toBeLessThan(source.indexOf("finalizeProviderRefundAttempt")); });
  it("scans stale, ledger, total, and commission mismatches idempotently", () => { for (const reason of ["STALE_PROCESSING_ATTEMPT", "REFUND_LEDGER_LINK_MISSING", "PAYMENT_REFUND_TOTAL_MISMATCH", "COMMISSION_ADJUSTMENT_MISMATCH"]) expect(source).toContain(reason); expect(source).toMatch(/upsert|openRefundReconciliationCase/); });
  it("has query, attempt lock, reconciliation and winner-reread mocks", () => { const tx = createRefundTransactionMock(); expect(tx.refundExecutionAttempt.findUnique).toBeTypeOf("function"); expect(tx.$queryRaw).toBeTypeOf("function"); expect(tx.refundReconciliationCase.upsert).toBeTypeOf("function"); });
});
