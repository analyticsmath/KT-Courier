import { Prisma } from "@prisma/client";
import { requiredDomainNotificationDefinitions } from "./required-domain-definitions";

/** Existing durable domain records are the outbox. No financial transaction is re-executed. */
export async function appendRequiredDomainNotificationIntents(db: Prisma.TransactionClient, limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid notification batch size.");
  const pairs = Prisma.join(requiredDomainNotificationDefinitions.filter((definition) => definition.sourceAuthority !== "LEGACY_ORDER").map((definition) => Prisma.sql`(${definition.sourceAuthority}, ${definition.eventType})`));
  const candidates = await db.$queryRaw<{ sourceAuthority: string; eventType: string; aggregateReference: string; operationId: string; sourceEventId: string; occurredAt: Date }[]>(Prisma.sql`
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
    )
    SELECT e.authority AS "sourceAuthority", e.type AS "eventType", e.aggregate AS "aggregateReference", e.operation AS "operationId", e.source AS "sourceEventId", e.occurred AS "occurredAt"
      FROM domain_events e JOIN (VALUES ${pairs}) AS supported(authority, type) ON supported.authority = e.authority AND supported.type = e.type
      JOIN "NotificationEventRoute" r ON r."sourceAuthority" = e.authority AND r."sourceEventType" = e.type
      WHERE EXISTS (SELECT 1 FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v.status = 'ACTIVE')
        AND e.occurred >= (SELECT min(v."activatedAt") FROM "NotificationEventRouteVersion" v WHERE v."routeId" = r.id AND v."activatedAt" IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM "NotificationEventIntent" i WHERE i."operationId" = e.operation)
      ORDER BY e.occurred, e.operation LIMIT ${Math.min(limit, 200)}
  `);
  for (const candidate of candidates) await db.notificationEventIntent.upsert({ where: { operationId: candidate.operationId }, update: {}, create: { sourceAuthority: candidate.sourceAuthority, eventType: candidate.eventType, aggregateReference: candidate.aggregateReference, operationId: candidate.operationId, safePayload: { sourceEventId: candidate.sourceEventId }, createdAt: candidate.occurredAt } });
  return candidates.length;
}
