import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reconcileCompletedParcelLoyalty } from "@/lib/rewards/customer-parcel-loyalty.service";

/**
 * Manually initiated loyalty reconciliation; deliberately not in the
 * production loop until financial flows and legal policy receive acceptance.
 * No client may supply an eligible paid amount or trigger a wallet credit.
 */
export async function runCustomerParcelLoyaltyBatch(input: {
  mode: "DRY_RUN" | "APPLY";
  batchSize: number;
}) {
  if (!Number.isSafeInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 200) {
    throw new Error("Invalid loyalty reconciliation batch size.");
  }
  if (input.mode !== "DRY_RUN" && input.mode !== "APPLY") {
    throw new Error("Invalid loyalty reconciliation execution mode.");
  }

  // Includes newly completed parcels/marketplace orders and prior earnings with updated refund
  // or delivery state; ensures cancelled orders reverse earned points.
  const candidates = await prisma.$queryRaw<Array<{ paymentId: string; customerUserId: string }>>(Prisma.sql`
    WITH candidates AS (
      SELECT p."id" AS "paymentId", o."customerId" AS "customerUserId", p."createdAt" AS "createdAt"
      FROM "Payment" p
      JOIN "Order" o ON o."id" = p."orderId"
      JOIN "User" u ON u."id" = o."customerId"
      LEFT JOIN "CustomerLoyaltyEarning" earning ON earning."paymentId" = p."id"
      WHERE p."subjectType" = 'COURIER_ORDER'
        AND p."status" = 'SUCCEEDED'
        AND p."providerConfirmedAt" IS NOT NULL
        AND p."successLedgerJournalId" IS NOT NULL
        AND p."successWebhookEventId" IS NOT NULL
        AND p."successfulAttemptId" IS NOT NULL
        AND u."role" = 'CUSTOMER' AND u."status" = 'ACTIVE'
        AND (
          (earning."paymentId" IS NULL AND o."status" IN ('DELIVERED', 'COMPLETED'))
          OR
          (earning."paymentId" IS NOT NULL AND
            (p."updatedAt" > earning."updatedAt" OR o."updatedAt" > earning."updatedAt"))
        )
      UNION ALL
      SELECT p."id" AS "paymentId", mo."customerUserId" AS "customerUserId", p."createdAt" AS "createdAt"
      FROM "Payment" p
      JOIN "MarketplaceOrder" mo ON mo."id" = p."marketplaceOrderId"
      JOIN "User" u ON u."id" = mo."customerUserId"
      LEFT JOIN "CustomerLoyaltyEarning" earning ON earning."paymentId" = p."id"
      WHERE p."subjectType" = 'MARKETPLACE_CHECKOUT'
        AND p."status" = 'SUCCEEDED'
        AND p."providerConfirmedAt" IS NOT NULL
        AND p."successLedgerJournalId" IS NOT NULL
        AND p."successWebhookEventId" IS NOT NULL
        AND p."successfulAttemptId" IS NOT NULL
        AND u."role" = 'CUSTOMER' AND u."status" = 'ACTIVE'
        AND (
          (earning."paymentId" IS NULL AND mo."status" = 'CONFIRMED')
          OR
          (earning."paymentId" IS NOT NULL AND
            (p."updatedAt" > earning."updatedAt" OR mo."createdAt" > earning."updatedAt"))
        )
    )
    SELECT "paymentId", "customerUserId"
    FROM candidates
    ORDER BY "createdAt" DESC, "paymentId" DESC
    LIMIT ${input.batchSize}
  `);

  if (input.mode === "DRY_RUN") {
    return {
      itemsExamined: candidates.length,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsSkipped: candidates.length,
      itemsRetried: 0,
      itemsReconciled: 0,
      safeSummary: `Examined ${candidates.length} potentially eligible parcel loyalty sources; no changes made.`,
    };
  }

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let reversed = 0;
  for (const candidate of candidates) {
    try {
      const result = await reconcileCompletedParcelLoyalty(candidate.customerUserId, candidate.paymentId);
      if (result.status === "AWARDED") completed++;
      else if (result.status === "REVERSED") {
        reversed++;
        completed++;
      } else skipped++;
    } catch {
      failed++; // Quarantine result from user-visible details; operator review.
    }
  }
  return {
    itemsExamined: candidates.length,
    itemsClaimed: candidates.length,
    itemsCompleted: completed,
    itemsSkipped: skipped,
    itemsRetried: failed,
    itemsReconciled: reversed,
    safeSummary: `Parcel loyalty: ${completed} adjusted (${reversed} reversed), ${skipped} unchanged, ${failed} require investigation. No wallet funds transferred.`,
  };
}
