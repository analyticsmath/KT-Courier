import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { verifyMarketplaceGuestSecret } from "@/lib/marketplace-checkout/tokens";

export class MarketplaceDeliveryTrackingError extends Error {
  constructor(readonly code: "NOT_FOUND" | "ACCESS_DENIED", message: string) {
    super(message);
    this.name = "MarketplaceDeliveryTrackingError";
  }
}

export type CustomerTrackingRow = Readonly<{
  marketplaceOrderReference: string;
  customerUserId: string | null;
  guestConfirmationHash: string | null;
  marketplaceStatus: string;
  storeOrderReference: string;
  preparationStatus: string;
  resolutionStatus: string;
  bridgeStatus: string;
  courierOrderReference: string | null;
  courierStatus: string | null;
  assignmentStatus: string | null;
  locationLatitude: Prisma.Decimal | null;
  locationLongitude: Prisma.Decimal | null;
  locationObservedAt: Date | null;
}>;

export type CustomerTrackingStoreOrder = Readonly<{
  storeOrderReference: string;
  fulfilmentStatus: string;
  deliveryStatus: string;
  courierOrderReference: string | null;
  assignmentStatus: string | null;
  liveLocation: Readonly<{ latitude: number; longitude: number; observedAt: string }> | null;
}>;

function allowsCustomerLocation(status: string | null): boolean {
  return status === "PICKED_UP" || status === "IN_TRANSIT" || status === "DELIVERY_ATTEMPTED";
}

function coarsenCoordinate(value: Prisma.Decimal): number {
  return Math.round(Number(value) * 100) / 100;
}

export function projectCustomerTrackingStoreOrder(row: CustomerTrackingRow): CustomerTrackingStoreOrder {
  const mayExposeLocation = allowsCustomerLocation(row.courierStatus);
  return Object.freeze({
    storeOrderReference: row.storeOrderReference,
    fulfilmentStatus: row.preparationStatus,
    deliveryStatus: row.bridgeStatus,
    courierOrderReference: row.courierOrderReference,
    assignmentStatus: row.assignmentStatus,
    liveLocation: mayExposeLocation && row.locationLatitude && row.locationLongitude && row.locationObservedAt
      ? Object.freeze({
        latitude: coarsenCoordinate(row.locationLatitude),
        longitude: coarsenCoordinate(row.locationLongitude),
        observedAt: row.locationObservedAt.toISOString(),
      })
      : null,
  });
}

/**
 * Customer-only marketplace projection. It deliberately omits driver identity,
 * raw history, route estimates, destination details, and any location before
 * custody or after terminal completion.
 */
export async function getMarketplaceDeliveryTracking(input: Readonly<{
  marketplaceOrderReference: string;
  customerUserId?: string;
  guestSecret?: string;
}>) {
  const rows = await prisma.$queryRaw<CustomerTrackingRow[]>(Prisma.sql`
    SELECT marketplace_order."publicReference" AS "marketplaceOrderReference",
      marketplace_order."customerUserId", marketplace_order."guestConfirmationHash", marketplace_order."status" AS "marketplaceStatus",
      store_order."publicReference" AS "storeOrderReference", store_order."preparationStatus", store_order."resolutionStatus",
      store_order."deliveryBridgeStatus" AS "bridgeStatus", courier_order."orderNumber" AS "courierOrderReference",
      courier_order."status" AS "courierStatus", assignment."status" AS "assignmentStatus",
      latest_location."latitude" AS "locationLatitude", latest_location."longitude" AS "locationLongitude",
      latest_location."receivedAt" AS "locationObservedAt"
    FROM "MarketplaceOrder" marketplace_order
    JOIN "MarketplaceStoreOrder" store_order ON store_order."marketplaceOrderId" = marketplace_order."id"
    LEFT JOIN "MarketplaceStoreOrderDeliveryBridge" bridge ON bridge."marketplaceStoreOrderId" = store_order."id"
    LEFT JOIN "Order" courier_order ON courier_order."id" = bridge."courierOrderId"
    LEFT JOIN "OrderAssignment" assignment ON assignment."orderId" = courier_order."id" AND assignment."activeOrderGuard" = courier_order."id"
    LEFT JOIN LATERAL (
      SELECT location."latitude", location."longitude", location."receivedAt"
      FROM "DriverLocationEvidence" location
      WHERE location."assignmentId" = assignment."id"
        AND location."validationStatus" = 'ACCEPTED'
      ORDER BY location."receivedAt" DESC
      LIMIT 1
    ) latest_location ON TRUE
    WHERE marketplace_order."publicReference" = ${input.marketplaceOrderReference}
    ORDER BY store_order."publicReference" ASC
  `);
  const first = rows[0];
  if (!first) throw new MarketplaceDeliveryTrackingError("NOT_FOUND", "Marketplace order was not found.");
  const customerOwnsOrder = Boolean(input.customerUserId) && first.customerUserId === input.customerUserId;
  const guestOwnsOrder = !first.customerUserId && verifyMarketplaceGuestSecret(input.guestSecret, first.guestConfirmationHash);
  if (!customerOwnsOrder && !guestOwnsOrder) {
    throw new MarketplaceDeliveryTrackingError("ACCESS_DENIED", "Marketplace order tracking is unavailable.");
  }
  return Object.freeze({
    marketplaceOrderReference: first.marketplaceOrderReference,
    status: first.marketplaceStatus,
    storeOrders: Object.freeze(rows.map(projectCustomerTrackingStoreOrder)),
  });
}
