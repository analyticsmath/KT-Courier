import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db/prisma";
import { createReconciliationCase } from "./promotion-reconciliation.service";
import { assertPromotionsProductionReady } from "./production-lock";

/** A cursor permits an operator to progress past healthy budgets without an unbounded scan. */
export async function scanPromotionBudgetReconciliation({ limit = 100, after, apply = false }: { limit?: number; after?: string; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid promotion reconciliation scan parameters.");
  if (apply) assertPromotionsProductionReady("RECONCILIATION");
  const rows = await prisma.promotionBudget.findMany({ where: after ? { id: { gt: after } } : {}, select: { id: true }, orderBy: { id: "asc" }, take: limit + 1 });
  const page = rows.slice(0, limit);
  let mismatches = 0, cases = 0;
  for (const row of page) {
    const observation = await prisma.$transaction(async (tx) => {
      const budget = await tx.promotionBudget.findUnique({ where: { id: row.id }, select: { campaignVersionId: true, reservedAmount: true, releasedAmount: true } });
      if (!budget) return null;
      const reservations = await tx.promotionReservation.aggregate({ where: { campaignVersionId: budget.campaignVersionId, status: "RESERVED" }, _sum: { reservedDiscountAmount: true } });
      return { versionId: budget.campaignVersionId, mismatch: !budget.reservedAmount.minus(budget.releasedAmount).equals(new Decimal(reservations._sum.reservedDiscountAmount ?? 0)) };
    }, { isolationLevel: "RepeatableRead" });
    if (!observation?.mismatch) continue;
    mismatches++;
    if (apply) { await createReconciliationCase("BUDGET_MISMATCH", { campaignVersionId: observation.versionId }); cases++; }
  }
  return { examined: page.length, mismatches, cases, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
