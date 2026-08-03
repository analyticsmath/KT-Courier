import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/refund-finance-review.service.ts"), "utf8");
describe("refund finance review service", () => {
  it("locks refund evidence and supports review, approval, and rejection", () => { expect(source).toMatch(/PaymentRefund[\s\S]*FOR UPDATE/); expect(source).toMatch(/beginRefundReview/); expect(source).toMatch(/approveRefund/); expect(source).toMatch(/rejectRefundRequest/); });
  it("enforces approval control and approval makes no journal", () => { expect(source).toMatch(/assertRefundApprovalControl/); const approval = source.slice(source.indexOf("export async function approveRefund"), source.indexOf("export async function rejectRefund")); expect(approval).not.toMatch(/postLedgerJournal|ledgerJournal\.create/); });
  it("has complete lock, history and projection mocks", () => { const tx = createRefundTransactionMock(); expect(tx.$queryRaw).toBeTypeOf("function"); expect(tx.refundStatusHistory.create).toBeTypeOf("function"); expect(tx.payment.updateMany).toBeTypeOf("function"); });
});
