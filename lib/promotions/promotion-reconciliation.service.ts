import { assertPromotionsProductionReady } from "./production-lock";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type PromotionReconciliationReason = "BUDGET_MISMATCH" | "EXPIRED_RESERVATION" | "ALLOCATION_MISMATCH";

const REASONS = {
  BUDGET_MISMATCH: { reason: "BUDGET_RESERVATION_MISMATCH", summary: "Promotion budget requires reconciliation." },
  EXPIRED_RESERVATION: { reason: "EXPIRED_RESERVATION_NOT_RELEASED", summary: "An expired promotion reservation requires reconciliation." },
  ALLOCATION_MISMATCH: { reason: "ALLOCATION_SUM_MISMATCH", summary: "Promotion allocation requires reconciliation." },
} as const;

export async function createReconciliationCase(reason: PromotionReconciliationReason, details: { campaignVersionId: string }) {
  assertPromotionsProductionReady("RECONCILIATION");
  const policy = REASONS[reason];
  if (!policy || typeof details?.campaignVersionId !== "string" || !details.campaignVersionId.trim()) throw new Error("A valid campaign version and reconciliation reason are required.");
  const campaignVersionId = details.campaignVersionId;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`promotion-reconciliation:${campaignVersionId}:${policy.reason}`}))::text`);
    if (!await tx.promotionCampaignVersion.findUnique({ where: { id: campaignVersionId }, select: { id: true } })) throw new Error("Promotion campaign version not found.");
    const existing = await tx.promotionReconciliationCase.findFirst({ where: { campaignVersionId, reason: policy.reason, status: { in: ["OPEN", "MONITORING"] } }, orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    return tx.promotionReconciliationCase.create({ data: { publicReference: `promo_rec_${randomUUID()}`, campaignVersionId, reason: policy.reason, status: "OPEN", safeSummary: policy.summary, safeEvidence: { source: "promotion_reconciliation" } } });
  });
}
