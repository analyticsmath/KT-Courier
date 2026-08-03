import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class AdvertisingAggregationService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async aggregateDailyMetrics(date: Date) {
    const startOfTargetDay = new Date(date);
    startOfTargetDay.setHours(0, 0, 0, 0);
    const endOfTargetDay = new Date(date);
    endOfTargetDay.setHours(23, 59, 59, 999);

    // 1. Group served impressions by campaignVersion and placementDefinition
    const servedImpressions = await this.db.advertisingMeasurementEvent.groupBy({
      by: ["campaignVersionId", "placementDefinitionId"],
      where: {
        eventType: "SERVED_IMPRESSION",
        eventTimestamp: { gte: startOfTargetDay, lte: endOfTargetDay }
      },
      _count: {
        id: true
      }
    });

    // 2. Group viewable impressions
    const viewableImpressions = await this.db.advertisingMeasurementEvent.groupBy({
      by: ["campaignVersionId", "placementDefinitionId"],
      where: {
        eventType: "VIEWABLE_IMPRESSION",
        eventTimestamp: { gte: startOfTargetDay, lte: endOfTargetDay }
      },
      _count: {
        id: true
      }
    });

    // 3. Group clicks (total, valid, invalid)
    const allClicks = await this.db.advertisingMeasurementEvent.findMany({
      where: {
        eventType: "CLICK",
        eventTimestamp: { gte: startOfTargetDay, lte: endOfTargetDay }
      }
    });

    // 4. Group spend (sum of click charges)
    const clickCharges = await this.db.advertisingClickCharge.groupBy({
      by: ["campaignVersionId", "rateCardVersionId"],
      where: {
        status: "CHARGED",
        chargedAt: { gte: startOfTargetDay, lte: endOfTargetDay }
      },
      _sum: {
        chargeAmount: true
      }
    });

    // We combine the metrics and perform upserts on AdvertisingDailyAggregate
    // For simplicity, let's load all combinations of campaignVersionId and placementDefinitionId active on this day
    const combinations = await this.db.advertisingCampaignVersion.findMany({
      where: {
        status: "ACTIVE",
        startsAt: { lte: endOfTargetDay },
        endsAt: { gte: startOfTargetDay }
      },
      select: {
        id: true,
        placementDefinitionId: true
      }
    });

    for (const combo of combinations) {
      const servedCount = servedImpressions.find(
        x => x.campaignVersionId === combo.id && x.placementDefinitionId === combo.placementDefinitionId
      )?._count.id ?? 0;

      const viewableCount = viewableImpressions.find(
        x => x.campaignVersionId === combo.id && x.placementDefinitionId === combo.placementDefinitionId
      )?._count.id ?? 0;

      const comboClicks = allClicks.filter(
        c => c.campaignVersionId === combo.id && c.placementDefinitionId === combo.placementDefinitionId
      );
      const totalClicks = comboClicks.length;
      const validClicks = comboClicks.filter(c => c.validityStatus === "VALID").length;
      const invalidClicks = comboClicks.filter(c => c.validityStatus === "INVALID").length;

      // Group spend charges
      // Since a campaignVersion could have click charges, let's sum them
      // Note: rateCardVersion has placementDefinitionId, so it is linked to the same placement
      const spendSum = clickCharges
        .filter(cc => cc.campaignVersionId === combo.id)
        .reduce((sum, cc) => sum.add(cc._sum.chargeAmount || new Prisma.Decimal(0)), new Prisma.Decimal(0));

      await this.db.advertisingDailyAggregate.upsert({
        where: {
          campaignVersionId_placementDefinitionId_date: {
            campaignVersionId: combo.id,
            placementDefinitionId: combo.placementDefinitionId,
            date: startOfTargetDay
          }
        },
        create: {
          campaignVersionId: combo.id,
          placementDefinitionId: combo.placementDefinitionId,
          date: startOfTargetDay,
          servedImpressions: servedCount,
          viewableImpressions: viewableCount,
          clicks: totalClicks,
          validClicks: validClicks,
          invalidClicks: invalidClicks,
          spend: spendSum,
          conversions: 0,
          attributedRevenue: new Prisma.Decimal(0),
          attributedUnits: 0
        },
        update: {
          servedImpressions: servedCount,
          viewableImpressions: viewableCount,
          clicks: totalClicks,
          validClicks: validClicks,
          invalidClicks: invalidClicks,
          spend: spendSum
        }
      });
    }
  }
}
