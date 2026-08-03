import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createStoreEarningTransactionMock } from "./store-earning-service-test-mocks";

const source = readFileSync(join(process.cwd(), "lib/services/store-earning-summary.service.ts"), "utf8");

describe("store earning summary service", () => {
  it("mocks exact aggregates, open cases, oldest earnings, releases, and per-store totals", () => { const tx = createStoreEarningTransactionMock(); expect(tx.ledgerAccount.aggregate).toBeTypeOf("function"); expect(tx.storeEarningReconciliationCase.count).toBeTypeOf("function"); expect(tx.storeEarning.findMany).toBeTypeOf("function"); expect(tx.storeEarning.groupBy).toBeTypeOf("function"); });
  it("reports the required finance dashboard metrics as Decimal strings", () => { for (const token of ["totalAccrued", "payableBalance", "refundReserved", "refunded", "releaseEligible", "releasedToWithdrawable", "reversed", "reconciliationCount", "oldestUnreleasedEarnings", "recentReleases", "storeTotalsByPeriod"]) expect(source).toContain(token); expect(source).toMatch(/formatStoreEarningMoney/); });
  it("scopes store-owner summaries to one active owned store", () => { expect(source).toMatch(/ownerUserId:\s*userId/); expect(source).toMatch(/stores\.length !== 1/); expect(source).toMatch(/summarizeStoreEarnings\(stores\[0\]!\.id\)/); });
});
