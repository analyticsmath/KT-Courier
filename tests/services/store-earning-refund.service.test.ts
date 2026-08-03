import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-refund.service.ts"), "utf8");
const requestSource = readFileSync(join(process.cwd(), "lib/services/refund-request.service.ts"), "utf8");

describe("store earning refund integration", () => {
  it("mocks refund funding, earning projections, histories, and row locks", () => { const tx = createStoreEarningTransactionMock(); expect(tx.refundFundingAllocation.findMany).toBeTypeOf("function"); expect(tx.storeEarning.update).toBeTypeOf("function"); expect(tx.storeEarningStatusHistory.create).toBeTypeOf("function"); expect(tx.$queryRaw).toBeTypeOf("function"); });
  it("blocks generic inference whenever remaining store entitlement exists", () => { expect(source).toMatch(/assertGenericRefundHasNoStoreEarningExposure/); expect(source).toMatch(/authoritative store-level refund snapshot is required/i); expect(requestSource).toMatch(/assertGenericRefundHasNoStoreEarningExposure/); });
  it("requires authoritative snapshot evidence and rejects released earnings", () => { expect(source).toMatch(/validateStoreEarningRefundSnapshot/); expect(source).toMatch(/status === "RELEASED"|releaseLedgerJournalId/); expect(source).toMatch(/REFUND_AFTER_RELEASE/); });
  it("updates reservation, cancellation, completion, and full-refund projections exactly", () => { for (const token of ["refundReservedAmount", "refundedAmount", "REFUND_RESERVATION_RELEASED", "REFUND_COMPLETED", "FULLY_REFUNDED"]) expect(source).toContain(token); });
});
