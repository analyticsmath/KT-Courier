import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db/prisma";
import { createReconciliationCase } from "./promotion-reconciliation.service";
import { assertPromotionsProductionReady } from "./production-lock";
import { createHash, randomUUID } from "node:crypto";

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

/** Find missing or inconsistent subsidy journals without inventing a financial posting. */
export async function scanPromotionFunding({ limit = 100, after, apply = false }: { limit?: number; after?: string; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (after !== undefined && (!after || after.length > 200))) throw new Error("Invalid promotion funding scan parameters.");
  if (apply) assertPromotionsProductionReady("RECONCILIATION");
  const rows = await prisma.promotionRedemption.findMany({
    where: { platformFunding: { gt: 0 }, ...(after ? { id: { gt: after } } : {}) },
    select: { id: true }, orderBy: { id: "asc" }, take: limit + 1,
  });
  const page = rows.slice(0, limit);
  let mismatches = 0, cases = 0;
  for (const row of page) {
    const mismatch = await prisma.$transaction(async tx => {
      if (apply) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`promotion-funding-scan:${row.id}`},0))::text`;
      const redemption = await tx.promotionRedemption.findUnique({ where: { id: row.id }, select: { id: true, campaignVersionId: true, marketplaceOrderId: true, platformFunding: true } });
      if (!redemption) return false;
      const journal = await tx.ledgerJournal.findUnique({ where: { idempotencyKey: `LJ-PROMO-${redemption.id}` }, include: { entries: { include: { account: true } } } });
      const sourceReference = `PROMO:${createHash("sha256").update(redemption.id).digest("hex").toUpperCase()}`;
      const valid = journal && journal.type === "GENERAL" && journal.currency === "ZAR" && journal.sourceReference === sourceReference && journal.correlationId === redemption.marketplaceOrderId && journal.totalDebits.equals(redemption.platformFunding) && journal.totalCredits.equals(redemption.platformFunding) && journal.entries.length === 2 && journal.entries.some(entry => entry.lineCode === "PLATFORM_PROMO_EXPENSE" && entry.direction === "DEBIT" && entry.amount.equals(redemption.platformFunding) && entry.account.purpose === "PLATFORM_PROMOTION_EXPENSE") && journal.entries.some(entry => entry.lineCode === "CUSTOMER_FUNDS_PROMO_CREDIT" && entry.direction === "CREDIT" && entry.amount.equals(redemption.platformFunding) && entry.account.purpose === "HELD");
      if (valid) return false;
      if (apply) {
        const existing = await tx.promotionReconciliationCase.findFirst({ where: { redemptionId: redemption.id, reason: "PLATFORM_SUBSIDY_JOURNAL_MISSING", status: { in: ["OPEN", "MONITORING"] } }, select: { id: true } });
        if (!existing) await tx.promotionReconciliationCase.create({ data: { publicReference: `promo_rec_${randomUUID()}`, campaignVersionId: redemption.campaignVersionId, redemptionId: redemption.id, marketplaceOrderId: redemption.marketplaceOrderId, reason: "PLATFORM_SUBSIDY_JOURNAL_MISSING", status: "OPEN", safeSummary: "Promotion subsidy journal requires reconciliation.", safeEvidence: { source: "promotion_funding_scan" } } });
      }
      return true;
    }, { isolationLevel: "ReadCommitted" });
    if (mismatch) { mismatches++; if (apply) cases++; }
  }
  return { examined: page.length, mismatches, cases, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}
