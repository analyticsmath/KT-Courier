import { isFreshTrackingObservation } from "@/lib/maps/tracking-freshness";
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
  storeName: string;
  storeSlug: string;
  preparationStatus: string;
  acceptanceStatus?: string;
  resolutionStatus: string;
  bridgeStatus: string;
  courierOrderReference: string | null;
  courierStatus: string | null;
  assignmentStatus: string | null;
  locationLatitude: Prisma.Decimal | null;
  locationLongitude: Prisma.Decimal | null;
  locationObservedAt: Date | null;
  cashObligation?: Prisma.Decimal | null;
  cashCollected?: Prisma.Decimal | null;
  cashStatus?: string | null;
  proofMethod?: string | null;
  proofDeliveredAt?: Date | null;
}>;

export type CustomerTrackingStoreOrder = Readonly<{
  storeOrderReference: string;
  storeName: string;
  storeSlug: string;
  fulfilmentStatus: string;
  deliveryStatus: string;
  courierOrderReference: string | null;
  assignmentStatus: string | null;
  cashOnDelivery: Readonly<{ obligation: string; collected: string; outstanding: string; status: string }> | null;
  liveLocation: Readonly<{ latitude: number; longitude: number; observedAt: string }> | null;
  proofOfDelivery: Readonly<{ method: string; deliveredAt: string }> | null;
}>;

function allowsCustomerLocation(status: string | null): boolean {
  return status === "PICKED_UP" || status === "IN_TRANSIT" || status === "DELIVERY_ATTEMPTED";
}

function coarsenCoordinate(value: Prisma.Decimal): number {
  return Math.round(Number(value) * 100) / 100;
}

export function projectCustomerTrackingStoreOrder(row: CustomerTrackingRow, now = new Date()): CustomerTrackingStoreOrder {
  const mayExposeLocation = allowsCustomerLocation(row.courierStatus);
  const obligation = row.cashObligation ?? new Prisma.Decimal(0);
  const collected = row.cashCollected ?? new Prisma.Decimal(0);
  // The parent order is authoritative for the customer's remaining debt.
  // A stale courier-cash projection must never ask a customer to pay again
  // after the marketplace order has been cancelled.
  const cashStatus = row.marketplaceStatus === "CANCELLED" || ["REJECTED", "TIMED_OUT"].includes(row.acceptanceStatus ?? "") || row.preparationStatus === "ABORTED" ? "CANCELLED" : row.cashStatus ?? "PENDING";
  const outstanding = cashStatus === "CANCELLED" ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, obligation.sub(collected));
  return Object.freeze({
    cashOnDelivery: obligation.gt(0) ? Object.freeze({ obligation: obligation.toFixed(2), collected: collected.toFixed(2), outstanding: outstanding.toFixed(2), status: cashStatus }) : null,
    storeOrderReference: row.storeOrderReference,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    fulfilmentStatus: row.preparationStatus,
    deliveryStatus: row.bridgeStatus,
    courierOrderReference: row.courierOrderReference,
    assignmentStatus: row.assignmentStatus,
    // Only an owner who can access this marketplace order sees the proof.
    // No recipient phone, internal note, raw GPS or evidence token is exposed.
    proofOfDelivery: ["DELIVERED", "COMPLETED"].includes(row.courierStatus ?? "") &&
      row.proofMethod && row.proofDeliveredAt
      ? Object.freeze({ method: row.proofMethod, deliveredAt: row.proofDeliveredAt.toISOString() })
      : null,
    liveLocation: mayExposeLocation && row.locationLatitude && row.locationLongitude && row.locationObservedAt && isFreshTrackingObservation(row.locationObservedAt, now.getTime())
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
      store_order."publicReference" AS "storeOrderReference", store_order."preparationStatus", store_order."acceptanceStatus", store_order."resolutionStatus",
      store."name" AS "storeName", store."slug" AS "storeSlug",
      store_order."deliveryBridgeStatus" AS "bridgeStatus", courier_order."orderNumber" AS "courierOrderReference",
      courier_order."status" AS "courierStatus", assignment."status" AS "assignmentStatus",
      latest_location."latitude" AS "locationLatitude", latest_location."longitude" AS "locationLongitude",
      latest_location."receivedAt" AS "locationObservedAt",
      COALESCE(cod."cashObligation", marketplace_order."cashRequired") AS "cashObligation",
      cod."cashCollected", cod."status"::text AS "cashStatus",
      pod."method"::text AS "proofMethod", pod."deliveredAt" AS "proofDeliveredAt"
    FROM "MarketplaceOrder" marketplace_order
    JOIN "MarketplaceStoreOrder" store_order ON store_order."marketplaceOrderId" = marketplace_order."id"
    JOIN "Store" store ON store."id" = store_order."storeId"
    LEFT JOIN "MarketplaceStoreOrderDeliveryBridge" bridge ON bridge."marketplaceStoreOrderId" = store_order."id"
    LEFT JOIN "Order" courier_order ON courier_order."id" = bridge."courierOrderId"
    LEFT JOIN "CashOnDelivery" cod ON cod."orderId" = courier_order."id"
    LEFT JOIN "OrderAssignment" assignment ON assignment."orderId" = courier_order."id" AND assignment."activeOrderGuard" = courier_order."id"
    LEFT JOIN "ProofOfDelivery" pod ON pod."orderId" = courier_order."id"
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
    storeOrders: Object.freeze(rows.map(row => projectCustomerTrackingStoreOrder(row))),
  });
}
