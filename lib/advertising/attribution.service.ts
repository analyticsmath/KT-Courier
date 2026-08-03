import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class AdvertisingAttributionService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async attributeOrder(marketplaceOrderId: string) {
    const order = await this.db.marketplaceOrder.findUnique({
      where: { id: marketplaceOrderId },
      include: {
        storeOrders: {
          include: {
            // Include order lines or storefront items to determine product id and revenue
            // Since we need to know what was purchased, let's look up StoreOrder lines.
            // Wait, let's check storeOrder model structure if needed.
          }
        },
        checkout: true
      }
    });
    if (!order) return;

    // Retrieve order checkout details
    const sessionFingerprint = (order.checkout as any)?.sessionFingerprint ?? null;
    const orderConfirmedAt = order.confirmedAt;

    // Find all valid clicks in session or matching user before orderConfirmedAt
    // Let's query click measurement events
    const clicks = await this.db.advertisingMeasurementEvent.findMany({
      where: {
        eventType: "CLICK",
        validityStatus: "VALID",
        sessionFingerprint,
        eventTimestamp: { lte: orderConfirmedAt }
      },
      orderBy: { eventTimestamp: "desc" },
      include: {
        campaignVersion: {
          include: {
            campaign: true
          }
        }
      }
    });

    if (clicks.length === 0) return;

    // For each store order/product, check last valid sponsored click within its attribution window
    for (const storeOrder of order.storeOrders) {
      // Find latest valid click for this store/product
      const matchingClick = clicks.find(click => {
        // If sponsored product, must match storeOrder's store or product
        const windowStart = new Date(orderConfirmedAt.getTime() - click.campaignVersion.attributionWindowDays * 24 * 3600 * 1000);
        if (click.eventTimestamp < windowStart) return false;

        if (click.campaignVersion.sponsoredObjectType === "PRODUCT") {
          // Verify if this click was for a product of this store
          return click.campaignVersion.campaign.storeId === storeOrder.storeId;
        } else {
          // Sponsored store
          return click.campaignVersion.sponsoredStoreId === storeOrder.storeId;
        }
      });

      if (!matchingClick) continue;

      // Found matching click! Create Attribution record
      const publicRef = `AD-ATR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const attributedRevenue = storeOrder.merchandiseSubtotal;

      await this.db.advertisingAttribution.create({
        data: {
          publicReference: publicRef,
          campaignVersionId: matchingClick.campaignVersionId,
          clickEventId: matchingClick.id,
          marketplaceOrderId: order.id,
          marketplaceStoreOrderId: storeOrder.id,
          attributedRevenue,
          attributedQuantity: 1, // StoreOrder represents a store's bundle, attribute quantity 1 or sum of lines
          attributedAt: new Date()
        }
      });

      // Update daily aggregate conversions
      const aggDate = new Date(orderConfirmedAt);
      aggDate.setHours(0, 0, 0, 0);

      await this.db.advertisingDailyAggregate.upsert({
        where: {
          campaignVersionId_placementDefinitionId_date: {
            campaignVersionId: matchingClick.campaignVersionId,
            placementDefinitionId: matchingClick.placementDefinitionId,
            date: aggDate
          }
        },
        create: {
          campaignVersionId: matchingClick.campaignVersionId,
          placementDefinitionId: matchingClick.placementDefinitionId,
          date: aggDate,
          conversions: 1,
          attributedRevenue,
          attributedUnits: 1
        },
        update: {
          conversions: { increment: 1 },
          attributedRevenue: { increment: attributedRevenue },
          attributedUnits: { increment: 1 }
        }
      });
    }
  }
}
