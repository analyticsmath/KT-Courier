import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import { logApplicationEvent } from "@/lib/observability/logger";
import { assertPromotionsProductionReady } from "./production-lock";
import { releaseCheckoutPromotions } from "./promotion-release.service";

export async function expirePromotionReservations({ limit = 100, now = new Date(), apply = false }: { limit?: number; now?: Date; apply?: boolean } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid promotion reservation expiry batch parameters.");
  if (apply) assertPromotionsProductionReady("RELEASE");
  const candidates = await prisma.$queryRaw<Array<{ id: string; checkoutId: string }>>(Prisma.sql`
    SELECT r."id", r."checkoutId" FROM "PromotionReservation" r
    JOIN "MarketplaceCheckout" c ON c."id" = r."checkoutId"
    WHERE r."status" = 'RESERVED' AND r."expiresAt" <= ${now}
      AND c."status" IN ('CANCELLED', 'EXPIRED')
      AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."marketplaceCheckoutId" = c."id")
    ORDER BY r."expiresAt", r."id" LIMIT ${limit}`);
  const result = { examined: candidates.length, released: 0, skipped: 0, failed: 0 };
  if (!apply) return result;
  for (const candidate of candidates) {
    try {
      const released = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${candidate.checkoutId} FOR UPDATE`);
        const checkout = await tx.marketplaceCheckout.findUnique({ where: { id: candidate.checkoutId }, select: { status: true, payment: { select: { id: true } } } });
        if (!checkout || checkout.payment || !["CANCELLED", "EXPIRED"].includes(checkout.status)) return false;
        const operationId = `promotion-reservation-expiry:${candidate.id}`;
        const outcome = await releaseCheckoutPromotions({ reservationIds: [candidate.id], reason: "RESERVATION_EXPIRY", operationId, requestHash: createHash("sha256").update(operationId).digest("hex"), now }, tx);
        return outcome.releasedIds.length === 1;
      }, { isolationLevel: "Serializable" }));
      if (released) result.released++; else result.skipped++;
    } catch {
      result.failed++;
      logApplicationEvent({ level: "ERROR", event: "promotion.reservation_expiry_failed", message: "Promotion reservation expiry requires retry.", operation: "promotion_reservation_expiry", resourceReference: candidate.id, outcome: "FAILURE", errorCategory: "PROMOTION_RESERVATION_EXPIRY_FAILED" });
    }
  }
  return result;
}
