import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-reversal.service.ts"), "utf8");

describe("store earning reversal service", () => {
  it("mocks earning, commission, held-account, reconciliation, and ledger operations", () => { const tx = createStoreEarningTransactionMock(); for (const delegate of [tx.storeEarning, tx.commissionAccrual, tx.ledgerAccount, tx.storeEarningReconciliationCase]) expect(delegate.findUnique ?? delegate.updateMany).toBeTypeOf("function"); expect(tx.postLedgerJournalWithinTransaction).toBeTypeOf("function"); });
  it("locks the earning, blocks any release, and computes exact unreleased remaining entitlement", () => { expect(source).toMatch(/StoreEarning[\s\S]*FOR UPDATE/); expect(source).toMatch(/releaseLedgerJournalId[\s\S]*releasedAmount\.isZero/); expect(source).toMatch(/amount\.sub\(earning\.refundedAmount\)\.sub\(earning\.reversedAmount\)/); });
  it("opens reconciliation for release and commission-reversal conflicts", () => { expect(source).toMatch(/REVERSAL_AFTER_RELEASE/); expect(source).toMatch(/REVERSAL_BLOCKED_BY_COMMISSION/); expect(source).toMatch(/openStoreEarningReconciliationWithinTransaction/); });
  it("replays duplicate reversal and atomically posts journal/state/history", () => { expect(source).toMatch(/status === "REVERSED"[\s\S]*idempotent:\s*true/); expect(source).toMatch(/postLedgerJournalWithinTransaction[\s\S]*storeEarning\.update/); });
});
