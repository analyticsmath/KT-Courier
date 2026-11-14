import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { cumulativeLineAllocation } from "@/lib/store-orders/allocation";
import { lockBudgets, lockCampaignVersions } from "./promotion-repositories";
import { recordBudgetMovement } from "./promotion-budget.service";

/** Apply budget reversals from the immutable line allocations of an approved store adjustment. */
export async function reversePromotionBudgetForAdjustment(tx: Prisma.TransactionClient, input: { adjustmentId: string; storeOrderId: string; marketplaceOrderId: string; checkoutStoreGroupId: string; deliveryFeeAmount: Prisma.Decimal; allocations: readonly { marketplaceOrderLineId: string | null; allocationType: string; originalQuantity: number; resolvedQuantityBefore: number; resolvedQuantityAfter: number }[] }) {
  const redemptions = await tx.promotionRedemption.findMany({ where: { marketplaceOrderId: input.marketplaceOrderId }, include: { allocations: true } });
  if (!redemptions.length) return [];
  if (redemptions.some(redemption => !redemption.allocations.length)) throw new Error("Promotion redemption allocation evidence is unavailable.");
  const adjustments = input.allocations.filter(row => row.allocationType === "SELLER_BASIS");
  const lineIds = adjustments.map(row => row.marketplaceOrderLineId).filter((id): id is string => Boolean(id));
  if (lineIds.length !== adjustments.length || new Set(lineIds).size !== lineIds.length) throw new Error("Promotion adjustment line evidence is invalid.");
  const lines = await tx.marketplaceOrderLine.findMany({ where: { id: { in: lineIds }, marketplaceStoreOrderId: input.storeOrderId }, select: { id: true, checkoutLineSnapshotId: true, quantity: true } });
  if (lines.length !== lineIds.length) throw new Error("Promotion adjustment line is not part of the store order.");
  const group = await tx.marketplaceCheckoutStoreGroup.findUnique({ where: { id: input.checkoutStoreGroupId }, select: { deliveryFee: true } });
  if (!group || input.deliveryFeeAmount.isNegative() || input.deliveryFeeAmount.greaterThan(group.deliveryFee)) throw new Error("Promotion delivery adjustment evidence is invalid.");
  const plans = redemptions.map(redemption => {
    let amount = new Prisma.Decimal(0);
    for (const allocation of redemption.allocations.filter(row => row.storeGroupReference === input.checkoutStoreGroupId)) {
      if (allocation.allocationType === "MERCHANDISE") {
        const line = lines.find(row => row.checkoutLineSnapshotId === allocation.lineReference);
        if (!line) continue;
        const adjustment = adjustments.find(row => row.marketplaceOrderLineId === line.id)!;
        if (adjustment.originalQuantity !== line.quantity) throw new Error("Promotion adjustment quantity does not match the original line.");
        amount = amount.add(cumulativeLineAllocation({ totalAmount: allocation.discountAmount.toFixed(2), originalQuantity: line.quantity, previouslyResolvedQuantity: adjustment.resolvedQuantityBefore, resolvedQuantityAfter: adjustment.resolvedQuantityAfter }));
      } else if (allocation.allocationType === "DELIVERY" && input.deliveryFeeAmount.greaterThan(0)) {
        if (!input.deliveryFeeAmount.equals(group.deliveryFee)) throw new Error("Partial delivery promotion reversal requires reconciliation.");
        amount = amount.add(allocation.discountAmount);
      } else if (allocation.allocationType !== "DELIVERY") throw new Error("Unknown promotion allocation source.");
    }
    return { redemption, amount };
  }).filter(plan => plan.amount.greaterThan(0));
  await lockCampaignVersions(plans.map(plan => plan.redemption.campaignVersionId), tx);
  const budgets = await tx.promotionBudget.findMany({ where: { campaignVersionId: { in: plans.map(plan => plan.redemption.campaignVersionId) } } });
  await lockBudgets(budgets.map(budget => budget.id), tx);
  const results = [];
  for (const { redemption, amount } of plans) {
    const budget = budgets.find(row => row.campaignVersionId === redemption.campaignVersionId);
    if (!budget) throw new Error("Promotion budget evidence is unavailable.");
    const digest = createHash("sha256").update(`${input.adjustmentId}:${redemption.id}`).digest("hex");
    const operationId = `promotion-adjustment:${digest}`;
    const requestHash = createHash("sha256").update(`${input.adjustmentId}:${redemption.id}:${amount.toFixed(2)}`).digest("hex");
    const existing = await tx.promotionBudgetMovement.findUnique({ where: { operationId_movementType: { operationId, movementType: "REVERSE" } } });
    if (existing) {
      if (existing.requestHash !== requestHash || existing.redemptionId !== redemption.id || !existing.amount.equals(amount)) throw new Error("Promotion adjustment replay conflicts with original evidence.");
      results.push(existing.id); continue;
    }
    const previous = await tx.promotionBudgetMovement.aggregate({ where: { redemptionId: redemption.id, movementType: "REVERSE" }, _sum: { amount: true } });
    const cumulative = new Prisma.Decimal(previous._sum.amount ?? 0).add(amount);
    if (cumulative.greaterThan(redemption.discountAmount)) throw new Error("Promotion adjustment exceeds its original redemption.");
    const movement = await recordBudgetMovement({ budgetId: budget.id, campaignVersionId: redemption.campaignVersionId, movementType: "REVERSE", amount, operationId, requestHash, storeOrderId: input.storeOrderId, redemptionId: redemption.id }, tx);
    await tx.promotionRedemption.update({ where: { id: redemption.id }, data: { status: cumulative.equals(redemption.discountAmount) ? "FULLY_REVERSED" : "PARTIALLY_REVERSED" } });
    results.push(movement.movementId);
  }
  return results;
}
