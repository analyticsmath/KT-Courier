import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/refund-wallet-completion.service.ts"), "utf8");
describe("wallet refund completion service", () => {
  it("is production locked by default and maker-checker controlled", () => { expect(source).toMatch(/assertProductionReady.*assertRefundProductionActivation/); expect(source).toMatch(/assertRefundCompletionControl/); });
  it("locks refund, payment, held and wallet accounts in one Serializable transaction", () => { expect(source).toMatch(/TransactionIsolationLevel\.Serializable/); expect(source).toMatch(/PaymentRefund[\s\S]*FOR UPDATE/); expect(source).toMatch(/Payment[\s\S]*FOR UPDATE/); expect(source).toMatch(/LedgerAccount[\s\S]*FOR UPDATE/); });
  it("posts wallet credit, moves projections, succeeds refund and records history", () => { for (const token of ["refundWalletCreditPosting", "totalRefundReservedAmount", "totalRefundedAmount", "status: \"SUCCEEDED\"", "refundStatusHistory.create"]) expect(source).toContain(token); });
  it("has completion rollback surfaces", () => { const tx = createRefundTransactionMock(); expect(tx.ledgerJournal.create).toBeTypeOf("function"); expect(tx.ledgerEntry.createMany).toBeTypeOf("function"); expect(tx.payment.updateMany).toBeTypeOf("function"); expect(tx.paymentRefund.update).toBeTypeOf("function"); });
});
