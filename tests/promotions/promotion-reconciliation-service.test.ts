import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), create: vi.fn(), version: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mock.transaction } }));
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
import { createReconciliationCase } from "@/lib/promotions/promotion-reconciliation.service";

it("returns an existing open case for the same promotion and reason", async () => {
  const existing = { id: "case", status: "OPEN" };
  mock.version.mockResolvedValueOnce({ id: "version" }); mock.find.mockResolvedValueOnce(existing);
  mock.transaction.mockImplementationOnce(async (fn) => fn({ $queryRaw: vi.fn(), promotionCampaignVersion: { findUnique: mock.version }, promotionReconciliationCase: { findFirst: mock.find, create: mock.create } }));
  await expect(createReconciliationCase("BUDGET_MISMATCH", { campaignVersionId: "version" })).resolves.toEqual(existing);
  expect(mock.create).not.toHaveBeenCalled();
});

it("refuses a reconciliation case without a concrete subject", async () => {
  await expect(createReconciliationCase("BUDGET_MISMATCH", { campaignVersionId: "" })).rejects.toThrow("campaign version");
});
