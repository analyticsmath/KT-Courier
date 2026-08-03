/* eslint-disable @typescript-eslint/no-explicit-any -- the Phase 21 schema is intentionally not generated before Phase 26.5. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { OrderSource, OrderStatus } from "@/types/db";
import { generateOrderNumber } from "@/lib/utils/order-number";

export class MarketplaceCourierOrderError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "MarketplaceCourierOrderError"; }
}

/**
 * The canonical courier `Order` aggregate creation boundary for a paid
 * marketplace store order. Phase 21 calls this service; it never creates an
 * Order itself and it never creates a Payment.
 */
export async function createMarketplaceCourierOrderFromFrozenEvidence(input: Readonly<{
  storeOrderReference: string;
  deliveryQuoteReference: string;
  deliveryQuoteVersion: string;
  operationId: string;
}>) {
  const orderNumber = await generateOrderNumber();
  return prisma.$transaction(async (tx) => {
    const database = tx as any;
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "MarketplaceStoreOrder" WHERE "publicReference" = ${input.storeOrderReference} FOR UPDATE`);
    if (locked.length !== 1) throw new MarketplaceCourierOrderError("MARKETPLACE_COURIER_STORE_ORDER_NOT_FOUND", "Marketplace store order was not found.");
    const storeOrder = await database.marketplaceStoreOrder.findUnique({ where: { id: locked[0].id }, include: { marketplaceOrder: { include: { checkout: { include: { addressSnapshot: true, contactSnapshot: true } } } }, checkoutStoreGroup: { include: { store: { include: { defaultPickupAddress: true } } }, deliveryBridge: true } } });
    if (!storeOrder || storeOrder.acceptanceStatus !== "ACCEPTED" || !["CLEAR", "RESOLVED"].includes(storeOrder.resolutionStatus) || !["NOT_STARTED", "PREPARING", "READY_FOR_HANDOFF"].includes(storeOrder.preparationStatus)) throw new MarketplaceCourierOrderError("MARKETPLACE_COURIER_ORDER_INELIGIBLE", "Store order is not eligible for canonical courier creation.");
    if (storeOrder.deliveryBridge?.courierOrderId && storeOrder.deliveryBridge.courierOrderReference) return Object.freeze({ courierOrderId: storeOrder.deliveryBridge.courierOrderId, courierOrderReference: storeOrder.deliveryBridge.courierOrderReference, replayed: true });
    const group = storeOrder.checkoutStoreGroup;
    const checkout = storeOrder.marketplaceOrder.checkout;
    const pickup = group.store.defaultPickupAddress;
    const destination = checkout.addressSnapshot;
    if (group.fulfilmentMode !== "COURIER_DELIVERY" || group.deliveryQuoteReference !== input.deliveryQuoteReference || group.deliveryQuoteVersion !== input.deliveryQuoteVersion || !group.pickupLocationReference || !pickup || !destination) throw new MarketplaceCourierOrderError("MARKETPLACE_COURIER_FROZEN_EVIDENCE_INVALID", "Frozen Phase 6 quote, pickup location or Phase 20 destination evidence is unavailable.");
    const quote = await tx.pricingQuote.findUnique({ where: { id: input.deliveryQuoteReference } });
    if (!quote || `phase6:${quote.id}` !== input.deliveryQuoteVersion || quote.currency !== "ZAR") throw new MarketplaceCourierOrderError("MARKETPLACE_COURIER_FROZEN_QUOTE_INVALID", "Frozen delivery quote cannot be bound to a canonical courier order.");
    const existingCourierOrder = await tx.order.findUnique({ where: { pricingQuoteId: quote.id }, select: { id: true, orderNumber: true, pricingSnapshot: true } });
    if (existingCourierOrder && (existingCourierOrder.pricingSnapshot as any)?.marketplaceStoreOrderReference === storeOrder.publicReference) return Object.freeze({ courierOrderId: existingCourierOrder.id, courierOrderReference: existingCourierOrder.orderNumber, replayed: true });
    if (existingCourierOrder) throw new MarketplaceCourierOrderError("MARKETPLACE_COURIER_QUOTE_ALREADY_BOUND", "Frozen quote is already bound to another courier order.");
    const [pickupAddress, dropoffAddress] = await Promise.all([
      tx.address.create({ data: { type: "PICKUP", line1: pickup.line1, line2: pickup.line2, city: pickup.city, province: pickup.province, postalCode: pickup.postalCode, country: pickup.country, accessNotes: pickup.accessNotes, formattedAddress: pickup.formattedAddress, placeId: pickup.placeId, latitude: pickup.latitude, longitude: pickup.longitude } }),
      tx.address.create({ data: { type: "DROPOFF", contactName: destination.recipientName, line1: destination.line1, line2: destination.line2, city: destination.city, province: destination.province, postalCode: destination.postalCode, country: destination.country, accessNotes: destination.deliveryInstructions, latitude: (destination.protectedCoordinates as any)?.latitude ?? null, longitude: (destination.protectedCoordinates as any)?.longitude ?? null } }),
    ]);
    const courierOrder = await tx.order.create({ data: {
      orderNumber, source: OrderSource.STORE, status: OrderStatus.CONFIRMED, deliveryType: "SAME_DAY", currency: "ZAR",
      customerId: storeOrder.marketplaceOrder.customerUserId, storeId: storeOrder.storeId, pickupAddressId: pickupAddress.id, dropoffAddressId: dropoffAddress.id,
      recipientName: destination.recipientName, recipientPhone: checkout.contactSnapshot?.phone ?? null, parcelDescription: `Marketplace store order ${storeOrder.publicReference}`, parcelCount: 1,
      scheduledFor: storeOrder.scheduledFulfilmentAt ?? null, priceEstimate: group.deliveryFee, pricingQuoteId: quote.id,
      pricingSubtotal: quote.subtotal, pricingTaxAmount: quote.taxAmount, pricingTaxRate: quote.taxRate, pricingSnapshot: { source: "PHASE21_FROZEN_MARKETPLACE_QUOTE", deliveryQuoteReference: input.deliveryQuoteReference, deliveryQuoteVersion: input.deliveryQuoteVersion, marketplaceStoreOrderReference: storeOrder.publicReference, prepaidMarketplacePayment: true },
      deliveryRegionId: quote.destinationRegionId, distanceMeters: quote.distanceMeters, durationSeconds: quote.durationSeconds, routeCalculatedAt: quote.createdAt, routeProvider: quote.routeProvider,
      statusHistory: { create: { status: OrderStatus.CONFIRMED, note: "Prepaid marketplace courier order created from frozen Phase 20/6 evidence." } },
    } });
    return Object.freeze({ courierOrderId: courierOrder.id, courierOrderReference: courierOrder.orderNumber, replayed: false });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
