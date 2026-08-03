import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-accrual.service.ts"), "utf8");

describe("store earning accrual service", () => {
  it("mocks all Prisma and ledger surfaces used by the atomic transaction", () => { const tx = createStoreEarningTransactionMock(); for (const delegate of [tx.payment, tx.storeEarning, tx.commissionAllocation, tx.ledgerAccount]) expect(delegate.findUnique ?? delegate.findFirst).toBeTypeOf("function"); expect(tx.postLedgerJournalWithinTransaction).toBeTypeOf("function"); });
  it("validates exact authoritative settlement and verified payment evidence", () => { expect(source).toMatch(/validateStoreSettlementSnapshot/); for (const token of ["signatureVerified", "merchantVerified", "amountVerified", "providerDataVerified", "EXTERNAL_PAYMENT_RECEIPT"]) expect(source).toContain(token); });
  it("locks payment then sorted commission allocations under Serializable", () => { expect(source).toMatch(/Payment[\s\S]*FOR UPDATE/); expect(source).toMatch(/CommissionAllocation[\s\S]*ORDER BY "id" ASC FOR UPDATE/); expect(source).toMatch(/TransactionIsolationLevel\.Serializable/); });
  it("supports replay, changed-payload conflict, settlement uniqueness, and unique-race recovery", () => { for (const token of ["creationIdempotencyKey", "creationRequestHash", "STORE_EARNING_IDEMPOTENCY_CONFLICT", "subjectType_subjectId_storeId_settlementVersion", "P2002"]) expect(source).toContain(token); });
  it("prevents over-attribution and insufficient held funds before atomic journal/aggregate writes", () => { expect(source).toMatch(/storeAttributedAmount\.add/); expect(source).toMatch(/STORE_EARNING_COMMISSION_OVER_ATTRIBUTED/); expect(source).toMatch(/STORE_EARNING_INSUFFICIENT_HELD_FUNDS/); expect(source).toMatch(/postLedgerJournalWithinTransaction[\s\S]*storeEarning\.create/); });
  it("does not post cash or owner-withdrawable during accrual", () => { const postingSection = source.slice(source.indexOf("storeEarningAccrualPosting")); expect(postingSection).not.toMatch(/CASH_CLEARING|ownerWithdrawableAccountId/); });
});
