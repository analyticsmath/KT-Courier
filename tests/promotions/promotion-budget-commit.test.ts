import { expect, it, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
const update = vi.hoisted(() => vi.fn());
vi.mock("@/lib/promotions/production-lock", () => ({ assertPromotionsProductionReady: vi.fn() }));
vi.mock("@/lib/promotions/promotion-repositories", () => ({ PromotionBudgetRepo: { updateOptimistic: update } }));
import { recordBudgetMovement } from "@/lib/promotions/promotion-budget.service";

it("converts a reservation into a commitment without consuming the budget twice", async () => {
  const tx = { promotionBudget: { findUniqueOrThrow: vi.fn(async () => ({ id: "budget", campaignVersionId: "version", version: 1, approvedAmount: new Decimal(100), reservedAmount: new Decimal(30), committedAmount: new Decimal(0), releasedAmount: new Decimal(0), reversedAmount: new Decimal(0), dailyLimit: null })) }, promotionBudgetMovement: { aggregate: vi.fn(async () => ({ _sum: { amount: null } })), create: vi.fn(async () => ({ id: "movement" })) } };
  const result = await recordBudgetMovement({ budgetId: "budget", campaignVersionId: "version", movementType: "COMMIT", amount: new Decimal(30), operationId: "commit", requestHash: "hash" }, tx as never);
  expect(result.balanceAfter.toFixed(2)).toBe("70.00");
  expect(update).toHaveBeenCalledWith("budget", 1, expect.objectContaining({ reservedAmount: new Decimal(0), committedAmount: new Decimal(30), releasedAmount: new Decimal(0) }), tx);
});

it("refuses to commit more than the outstanding reservation", async () => {
  const tx = { promotionBudget: { findUniqueOrThrow: vi.fn(async () => ({ id: "budget", version: 1, approvedAmount: new Decimal(100), reservedAmount: new Decimal(30), committedAmount: new Decimal(0), releasedAmount: new Decimal(20), reversedAmount: new Decimal(0), dailyLimit: null })) }, promotionBudgetMovement: { aggregate: vi.fn(async () => ({ _sum: { amount: null } })), create: vi.fn() } };
  await expect(recordBudgetMovement({ budgetId: "budget", campaignVersionId: "version", movementType: "COMMIT", amount: new Decimal(11), operationId: "commit", requestHash: "hash" }, tx as never)).rejects.toThrow("exceeds outstanding");
  expect(tx.promotionBudgetMovement.create).not.toHaveBeenCalled();
});

it.each(["RELEASE", "EXPIRE"] as const)("refuses %s beyond outstanding reserved funds", async (movementType) => {
  const tx = { promotionBudget: { findUniqueOrThrow: vi.fn(async () => ({ id: "budget", version: 1, approvedAmount: new Decimal(100), reservedAmount: new Decimal(30), committedAmount: new Decimal(0), releasedAmount: new Decimal(20), reversedAmount: new Decimal(0), dailyLimit: null })) }, promotionBudgetMovement: { aggregate: vi.fn(async () => ({ _sum: { amount: null } })), create: vi.fn(async () => ({ id: "movement" })) } };
  await expect(recordBudgetMovement({ budgetId: "budget", campaignVersionId: "version", movementType, amount: new Decimal(11), operationId: "op", requestHash: "hash" }, tx as never)).rejects.toThrow("exceeds outstanding");
});

it("refuses reversal beyond the remaining committed budget", async () => {
  const tx = { promotionBudget: { findUniqueOrThrow: vi.fn(async () => ({ id: "budget", version: 1, approvedAmount: new Decimal(100), reservedAmount: new Decimal(0), committedAmount: new Decimal(30), releasedAmount: new Decimal(0), reversedAmount: new Decimal(20), dailyLimit: null })) }, promotionBudgetMovement: { aggregate: vi.fn(async () => ({ _sum: { amount: null } })), create: vi.fn(async () => ({ id: "movement" })) } };
  await expect(recordBudgetMovement({ budgetId: "budget", campaignVersionId: "version", movementType: "REVERSE", amount: new Decimal(11), operationId: "op", requestHash: "hash" }, tx as never)).rejects.toThrow("exceeds remaining commitment");
});
