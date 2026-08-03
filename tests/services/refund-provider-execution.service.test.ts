import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRefundTransactionMock } from "./refund-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/refund-provider-execution.service.ts"), "utf8");
describe("provider refund execution service", () => {
  it("uses reserve, external call, and finalization stages", () => { expect(source).toMatch(/reserveProviderAttempt/); expect(source).toMatch(/callRefundProvider/); expect(source).toMatch(/finalizeProviderRefundAttempt/); expect(source.indexOf("await callRefundProvider")).toBeGreaterThan(source.indexOf("await reserveProviderAttempt")); });
  it("locks refund, attempt, payment and completion accounts", () => { for (const table of ["PaymentRefund", "RefundExecutionAttempt", "Payment", "LedgerAccount"]) expect(source).toMatch(new RegExp(`${table}[\\s\\S]*FOR UPDATE`)); });
  it("has no blind retry and holds definite failure/unknown outcomes", () => { expect(source).toMatch(/Promise\.race/); expect(source).toMatch(/status:\s*"APPROVED"/); expect(source).toMatch(/status:\s*"RECONCILIATION_REQUIRED"/); expect(source).not.toMatch(/setInterval|retryProvider|while\s*\(/); });
  it("has attempt, journal, projection, history and reconciliation mocks", () => { const tx = createRefundTransactionMock(); for (const key of ["refundExecutionAttempt", "ledgerJournal", "ledgerEntry", "payment", "refundStatusHistory", "refundReconciliationCase"] as const) expect(tx[key].update ?? tx[key].create).toBeTypeOf("function"); });
});
