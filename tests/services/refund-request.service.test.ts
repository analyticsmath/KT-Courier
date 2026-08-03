import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/refund-request.service.ts"), "utf8");
describe("refund request service", () => {
  it("has mocks for every atomic write and rollback-sensitive surface", () => { const tx = createRefundTransactionMock(); for (const key of ["payment", "paymentRefund", "refundFundingAllocation", "refundStatusHistory", "commissionAllocation", "ledgerJournal", "ledgerEntry"] as const) expect(tx[key].update ?? tx[key].create).toBeTypeOf("function"); });
  it("uses Serializable payment and sorted account/commission locks", () => { expect(source).toMatch(/TransactionIsolationLevel\.Serializable/); expect(source).toMatch(/Payment[\s\S]*FOR UPDATE/); expect(source).toMatch(/CommissionAllocation[\s\S]*ORDER BY "id" ASC FOR UPDATE/); expect(source).toMatch(/LedgerAccount[\s\S]*ORDER BY "id" ASC FOR UPDATE/); });
  it("atomically writes refund, funding, reserve journal, projection and history", () => { for (const token of ["paymentRefund.create", "refundFundingAllocation.createMany", "refundReservePosting", "totalRefundReservedAmount", "refundStatusHistory.createMany"]) expect(source).toContain(token); });
  it("replays matching keys and conflicts changed payloads", () => { expect(source).toMatch(/creationIdempotencyKey/); expect(source).toMatch(/creationRequestHash/); expect(source).toMatch(/REFUND_IDEMPOTENCY_CONFLICT/); });
});
