import { expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
const mock = vi.hoisted(() => ({ budgets: vi.fn(), budget: vi.fn(), aggregate: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { promotionBudget: { findMany: mock.budgets }, $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/promotion-reconciliation.service", () => ({ createReconciliationCase: mock.create }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
import { scanPromotionBudgetReconciliation } from "@/lib/promotions/promotion-reconciliation-scan";

it("opens a case for a nonempty budget mismatch and returns the next cursor", async () => {
  mock.budgets.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
  mock.budget.mockResolvedValueOnce({ id: "a", campaignVersionId: "version", reservedAmount: new Decimal(30), releasedAmount: new Decimal(10) });
  mock.transaction.mockImplementationOnce(async (fn) => fn({ promotionBudget: { findUnique: mock.budget }, promotionReservation: { aggregate: mock.aggregate } }));
  mock.aggregate.mockResolvedValueOnce({ _sum: { reservedDiscountAmount: new Decimal(15) } });
  mock.create.mockResolvedValueOnce({ id: "case" });
  expect(await scanPromotionBudgetReconciliation({ limit: 1, apply: true })).toEqual({ examined: 1, mismatches: 1, cases: 1, nextCursor: "a" });
  expect(mock.create).toHaveBeenCalledWith("BUDGET_MISMATCH", { campaignVersionId: "version" });
});
