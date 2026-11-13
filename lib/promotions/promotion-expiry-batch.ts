import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import { logApplicationEvent } from "@/lib/observability/logger";
import { assertPromotionsProductionReady } from "./production-lock";

export async function expirePromotionCampaigns({ limit = 100, now = new Date(), apply = false }: { limit?: number; now?: Date; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid promotion expiry batch parameters.");
  if (apply) assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  const candidates = await prisma.promotionCampaignVersion.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] }, endsAt: { lte: now } },
    select: { id: true, campaignId: true, status: true },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }], take: limit,
  });
  const result = { examined: candidates.length, ended: 0, skipped: 0, failed: 0 };
  if (!apply) return result;
  for (const candidate of candidates) {
    try {
      const ended = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
        const changed = await tx.promotionCampaignVersion.updateMany({
          where: { id: candidate.id, status: candidate.status, endsAt: { lte: now } },
          data: { status: "ENDED", endedAt: now },
        });
        if (changed.count !== 1) return false;
        await tx.promotionCampaign.updateMany({
          where: { id: candidate.campaignId, status: { in: ["ACTIVE", "PAUSED"] }, versions: { none: { status: { in: ["ACTIVE", "PAUSED"] } } } },
          data: { status: "ENDED" },
        });
        const operationId = `promotion-expiry:${candidate.id}`;
        await tx.promotionStatusHistory.create({ data: { campaignVersionId: candidate.id, fromStatus: candidate.status, toStatus: "ENDED", reason: "Campaign reached its end time", operationId } });
        await tx.promotionEventIntent.create({ data: { eventType: "PROMOTION_ENDED", dedupeKey: operationId, payload: { campaignId: candidate.campaignId, campaignVersionId: candidate.id } } });
        return true;
      }, { isolationLevel: "Serializable" }));
      if (ended) result.ended++;
      else result.skipped++;
    } catch {
      result.failed++;
      logApplicationEvent({ level: "ERROR", event: "promotion.expiry_failed", message: "Promotion expiry failed and requires retry.", operation: "promotion_expiry", resourceReference: candidate.id, outcome: "FAILURE", errorCategory: "PROMOTION_EXPIRY_FAILED" });
    }
  }
  return result;
}
