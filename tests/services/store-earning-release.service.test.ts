import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-release.service.ts"), "utf8");

describe("store earning release service", () => {
  it("mocks earning/account/refund/payment/commission and journal operations", () => { const tx = createStoreEarningTransactionMock(); for (const delegate of [tx.storeEarning, tx.ledgerAccount, tx.refundFundingAllocation, tx.payment, tx.commissionAllocation]) expect(delegate.findUnique).toBeTypeOf("function"); expect(tx.postLedgerJournalWithinTransaction).toBeTypeOf("function"); });
  it("locks earning and rechecks every release condition in Serializable transaction", () => { expect(source).toMatch(/StoreEarning[\s\S]*FOR UPDATE/); expect(source).toMatch(/assertStoreEarningReleaseEligible/); expect(source).toMatch(/TransactionIsolationLevel\.Serializable/); });
  it("computes exact remaining and uses the canonical owner-withdrawable account", () => { expect(source).toMatch(/amount\.sub\(earning\.refundedAmount\)\.sub\(earning\.reversedAmount\)\.sub\(earning\.releasedAmount\)/); expect(source).toMatch(/purpose:\s*"OWNER_WITHDRAWABLE"/); });
  it("replays an existing release and commits journal, projection, status, and history together", () => { expect(source).toMatch(/status === "RELEASED"[\s\S]*idempotent:\s*true/); expect(source).toMatch(/postLedgerJournalWithinTransaction[\s\S]*storeEarning\.update/); expect(source).toMatch(/statusHistory/); });
});
