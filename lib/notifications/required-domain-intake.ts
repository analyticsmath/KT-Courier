import { Prisma } from "@prisma/client";
import { requiredDomainNotificationDefinitions } from "./required-domain-definitions";

/** Existing durable domain records are the outbox. No financial transaction is re-executed. */
async function pendingRequiredDomainEvents(db: Prisma.TransactionClient, limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid notification batch size.");
  const pairs = Prisma.join(requiredDomainNotificationDefinitions.filter((definition) => definition.sourceAuthority !== "LEGACY_ORDER").map((definition) => Prisma.sql`(${definition.sourceAuthority}, ${definition.eventType})`));
  return db.$queryRaw<{ sourceAuthority: string; eventType: string; aggregateReference: string; operationId: string; sourceEventId: string; occurredAt: Date }[]>(Prisma.sql`
    WITH domain_events AS (
      SELECT 'MARKETPLACE'::text AS authority, 'MARKETPLACE_ORDER_CONFIRMED'::text AS type,
        o.id AS aggregate, 'marketplace-order-notification:' || o.id AS operation, o.id AS source, o."confirmedAt" AS occurred
      FROM "MarketplaceOrder" o
      UNION ALL
      SELECT 'STORE_ORDERS', 'STORE_ORDER_RECEIVED', o.id, 'vendor-order-notification:' || o.id, o.id, o."createdAt" FROM "MarketplaceStoreOrder" o
      UNION ALL
      SELECT 'STORE_ORDERS', e."eventType", e."marketplaceStoreOrderId", 'store-order-notification:' || e.id, e.id, e."createdAt" FROM "MarketplaceStoreOrderEventIntent" e
      UNION ALL
      SELECT 'PAYMENT', 'PAYMENT_STATUS_CHANGED', p."paymentNumber", 'payment-status-notification:' || h.id, h.id, h."createdAt"
        FROM "PaymentStatusHistory" h JOIN "Payment" p ON p.id = h."paymentId" WHERE h."toStatus" IN ('FAILED', 'CANCELLED', 'EXPIRED')
      UNION ALL
      SELECT 'REFUND', 'REFUND_STATUS_CHANGED', h."refundId", 'refund-status-notification:' || h.id, h.id, h."createdAt" FROM "RefundStatusHistory" h
        WHERE h."operationId" IS NOT NULL OR h."fromStatus" IS NOT NULL
      UNION ALL
      SELECT 'DISPATCH', 'DRIVER_ASSIGNMENT_STATUS_CHANGED', h."assignmentId", 'driver-assignment-notification:' || h.id, h.id, h."createdAt" FROM "OrderAssignmentEvent" h WHERE h."newStatus" IS NOT NULL
      UNION ALL
      SELECT 'WITHDRAWAL', w."ownerType"::text || '_WITHDRAWAL_STATUS_CHANGED', w.id, 'withdrawal-status-notification:' || h.id, h.id, h."createdAt"
        FROM "WithdrawalStatusHistory" h JOIN "WithdrawalRequest" w ON w.id = h."withdrawalId"
        WHERE w."ownerType" IN ('STORE', 'DRIVER') AND ((h."fromStatus" IS NOT NULL AND h."fromStatus" <> h."toStatus") OR h."reasonCode" = 'WITHDRAWAL_REQUESTED')
      UNION ALL
      SELECT 'STORE_EARNINGS', 'STORE_EARNING_STATUS_CHANGED', h."storeEarningId", 'store-earning-notification:' || h.id, h.id, h."createdAt" FROM "StoreEarningStatusHistory" h WHERE h."fromStatus" IS NULL OR h."fromStatus" <> h."toStatus"
      UNION ALL
      SELECT 'DRIVER_EARNINGS', 'DRIVER_EARNING_STATUS_CHANGED', h."driverEarningId", 'driver-earning-notification:' || h.id, h.id, h."createdAt" FROM "DriverEarningStatusHistory" h WHERE h."fromStatus" IS NULL OR h."fromStatus" <> h."toStatus"
    )
    SELECT e.authority AS "sourceAuthority", e.type AS "eventType", e.aggregate AS "aggregateReference", e.operation AS "operationId", e.source AS "sourceEventId", e.occurred AS "occurredAt"
      FROM domain_events e JOIN (VALUES ${pairs}) AS supported(authority, type) ON supported.authority = e.authority AND supported.type = e.type
      JOIN "NotificationEventRoute" r ON r."sourceAuthority" = e.authority AND r."sourceEventType" = e.type
      WHERE EXISTS (SELECT 1 FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v.status = 'ACTIVE')
        AND e.occurred >= (SELECT min(v."activatedAt") FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v."activatedAt" IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM "NotificationEventIntent" i WHERE i."operationId" = e.operation)
      ORDER BY e.occurred, e.operation LIMIT ${Math.min(limit, 200)}
  `);
}

/** Read-only work discovery must include canonical events not yet in the outbox. */
export async function hasRequiredDomainNotificationWork(db: Prisma.TransactionClient) {
  return (await pendingRequiredDomainEvents(db, 1)).length > 0;
}

export async function appendRequiredDomainNotificationIntents(db: Prisma.TransactionClient, limit: number) {
  const candidates = await pendingRequiredDomainEvents(db, limit);
  // Empty-update upserts may use Prisma's read/create path, which races between
  // workers. PostgreSQL ON CONFLICT DO NOTHING preserves the first immutable
  // source intent and keeps concurrent intake from aborting its transaction.
  const inserted = await db.notificationEventIntent.createMany({ skipDuplicates: true, data: candidates.map((candidate) => ({ sourceAuthority: candidate.sourceAuthority, eventType: candidate.eventType, aggregateReference: candidate.aggregateReference, operationId: candidate.operationId, safePayload: { sourceEventId: candidate.sourceEventId }, createdAt: candidate.occurredAt })) });
  return inserted.count;
}
