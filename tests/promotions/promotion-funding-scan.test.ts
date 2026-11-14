import { beforeEach, expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { createHash } from "node:crypto";

const mock = vi.hoisted(() => ({ rows: vi.fn(), redemption: vi.fn(), journal: vi.fn(), existing: vi.fn(), create: vi.fn(), lock: vi.fn(), transaction: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { promotionRedemption: { findMany: mock.rows }, $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: mock.gate }));
import { scanPromotionFunding } from "@/lib/promotions/promotion-reconciliation-scan";

beforeEach(() => {
  vi.resetAllMocks();
  mock.rows.mockResolvedValue([{ id: "r" }]);
  mock.redemption.mockResolvedValue({ id: "r", campaignVersionId: "v", marketplaceOrderId: "o", platformFunding: new Decimal(6) });
  mock.transaction.mockImplementation(fn => fn({ $queryRaw: mock.lock, promotionRedemption: { findUnique: mock.redemption }, ledgerJournal: { findUnique: mock.journal }, promotionReconciliationCase: { findFirst: mock.existing, create: mock.create } }));
});

it("opens one review case for a missing journal and does not duplicate it on replay", async () => {
  mock.journal.mockResolvedValue(null);
  mock.existing.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing" });
  expect(await scanPromotionFunding({ apply: true })).toMatchObject({ examined: 1, mismatches: 1 });
  await scanPromotionFunding({ apply: true });
  expect(mock.create).toHaveBeenCalledTimes(1);
  expect(mock.create.mock.calls[0][0].data).toMatchObject({ redemptionId: "r", reason: "PLATFORM_SUBSIDY_JOURNAL_MISSING" });
  expect(mock.gate).toHaveBeenCalledWith("RECONCILIATION");
});

it("accepts a balanced source-bound journal and detects an incorrect account", async () => {
  const journal = { type: "GENERAL", currency: "ZAR", sourceReference: `PROMO:${createHash("sha256").update("r").digest("hex").toUpperCase()}`, correlationId: "o", totalDebits: new Decimal(6), totalCredits: new Decimal(6), entries: [
    { lineCode: "PLATFORM_PROMO_EXPENSE", direction: "DEBIT", amount: new Decimal(6), account: { purpose: "PLATFORM_PROMOTION_EXPENSE" } },
    { lineCode: "CUSTOMER_FUNDS_PROMO_CREDIT", direction: "CREDIT", amount: new Decimal(6), account: { purpose: "HELD" } },
  ] };
  mock.journal.mockResolvedValue(journal);
  expect(await scanPromotionFunding()).toMatchObject({ examined: 1, mismatches: 0 });
  journal.entries[1].account.purpose = "AVAILABLE";
  expect(await scanPromotionFunding()).toMatchObject({ examined: 1, mismatches: 1 });
  expect(mock.create).not.toHaveBeenCalled();
});
