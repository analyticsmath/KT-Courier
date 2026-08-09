import { prisma } from "@/lib/db/prisma";
import { Prisma, StoreStatus, ProductStatus, AdvertisingCampaignStatus, AdvertisingCampaignVersionStatus, AdvertisingPlacementStatus } from "@prisma/client";
import { createHmac } from "node:crypto";
import { assertAdvertisingProductionReady } from "./production-lock";

function getAdSecret(): string {
  if (process.env.AD_SECRET) return process.env.AD_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[KT ADVERTISING] AD_SECRET must be configured in production.");
  }
  return "ad_placement_secret_default_kt_courier_phase_24";
}

export type ContextualRequest = {
  searchKeyword?: string;
  categoryPath?: string;
  collectionSlug?: string;
  productContextId?: string;
  storeContextId?: string;
  deliveryRegionId?: string;
  serviceAreaId?: string;
  sessionFingerprint?: string;
};

export type ServeTokenPayload = {
  serveDecisionId: string;
  campaignVersionId: string;
  placementCode: string;
  sponsoredObjectType: string;
  sponsoredObjectId: string;
  sessionFingerprint: string;
  issuedAt: number;
  expiresAt: number;
  destinationReference: string;
};

export class AdvertisingServingService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  static generateSignedToken(payload: ServeTokenPayload): string {
    const data = JSON.stringify(payload);
    const signature = createHmac("sha256", getAdSecret()).update(data).digest("hex");
    return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url");
  }

  static verifySignedToken(token: string): ServeTokenPayload | null {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf-8");
      const { payload, signature } = JSON.parse(decoded);
      const expected = createHmac("sha256", getAdSecret()).update(JSON.stringify(payload)).digest("hex");
      if (signature !== expected) return null;
      if (Date.now() > payload.expiresAt) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async composeSponsoredMarketplacePlacements<T>(
    organicResults: T[],
    placementCode: string,
    context: ContextualRequest
  ): Promise<Array<T | { sponsored: true; creative: Record<string, unknown> | null; serveToken: string }>> {
    // Determine if serving is production-locked
    let isProductionLocked = false;
    try {
      assertAdvertisingProductionReady("SPONSORED_SERVING");
    } catch {
      isProductionLocked = true;
    }

    // If production locked, return organic results unchanged
    if (isProductionLocked) {
      return organicResults;
    }

    // 1. Resolve placement definition
    const placement = await this.db.advertisingPlacementDefinition.findUnique({
      where: { code: placementCode }
    });
    if (!placement || placement.status !== AdvertisingPlacementStatus.ACTIVE) {
      return organicResults;
    }

    // 2. Load candidate active campaign versions
    const now = new Date();
    const versions = await this.db.advertisingCampaignVersion.findMany({
      where: {
        status: AdvertisingCampaignVersionStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gte: now },
        placementDefinitionId: placement.id,
        campaign: {
          status: AdvertisingCampaignStatus.ACTIVE
        }
      },
      include: {
        campaign: {
          include: {
            store: { select: { status: true, name: true } }
          }
        },
        product: { select: { status: true } },
        fundingAllocations: {
          where: {
            status: { in: ["FUNDED", "PARTIALLY_SPENT"] }
          }
        },
        creativeSnapshots: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const eligibleVersions = [];

    // 3. Filter candidates for schedule, status, funding, and object status
    for (const ver of versions) {
      // Store status must be active
      if (ver.campaign.store.status !== StoreStatus.ACTIVE) continue;

      // Product eligibility if applicable
      if (ver.sponsoredObjectType === "PRODUCT") {
        if (!ver.product || ver.product.status !== ProductStatus.ACTIVE) continue;
      }

      // Check funding allocation status & remaining funds
      const remainingFunds = ver.fundingAllocations.reduce((sum, alloc) => sum.add(alloc.remainingAmount), new Prisma.Decimal(0));
      if (remainingFunds.lte(0)) continue;

      // Check daily budget limits (cumulative spend today)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const dailySpendResult = await this.db.advertisingClickCharge.aggregate({
        where: {
          campaignVersionId: ver.id,
          status: "CHARGED",
          chargedAt: { gte: startOfDay, lte: endOfDay }
        },
        _sum: {
          chargeAmount: true
        }
      });
      const dailySpend = dailySpendResult._sum.chargeAmount || new Prisma.Decimal(0);
      if (dailySpend.gte(ver.dailyBudget)) continue;

      // Check total budget limits
      const totalSpendResult = await this.db.advertisingClickCharge.aggregate({
        where: {
          campaignVersionId: ver.id,
          status: "CHARGED"
        },
        _sum: {
          chargeAmount: true
        }
      });
      const totalSpend = totalSpendResult._sum.chargeAmount || new Prisma.Decimal(0);
      if (totalSpend.gte(ver.totalBudget)) continue;

      // Contextual targeting evaluation
      const targets = await this.db.advertisingTarget.findMany({
        where: { campaignVersionId: ver.id }
      });

      // Exclusion matches
      const exclusions = targets.filter(t => t.effect === "EXCLUDE");
      let excluded = false;
      for (const exc of exclusions) {
        if (exc.targetType === "SEARCH_KEYWORD" && context.searchKeyword) {
          const normQuery = context.searchKeyword.toLowerCase().trim();
          if (normQuery.includes(exc.value.toLowerCase())) excluded = true;
        }
        if (exc.targetType === "CATEGORY" && context.categoryPath) {
          if (context.categoryPath.startsWith(exc.value)) excluded = true;
        }
        if (exc.targetType === "COLLECTION" && context.collectionSlug) {
          if (context.collectionSlug === exc.value) excluded = true;
        }
        if (exc.targetType === "PRODUCT_CONTEXT" && context.productContextId) {
          if (context.productContextId === exc.value) excluded = true;
        }
        if (exc.targetType === "STORE_CONTEXT" && context.storeContextId) {
          if (context.storeContextId === exc.value) excluded = true;
        }
        if (exc.targetType === "DELIVERY_REGION" && context.deliveryRegionId) {
          if (context.deliveryRegionId === exc.value) excluded = true;
        }
        if (exc.targetType === "SERVICE_AREA" && context.serviceAreaId) {
          if (context.serviceAreaId === exc.value) excluded = true;
        }
      }
      if (excluded) continue;

      // Inclusion matches (if inclusions exist, at least one must match)
      const inclusions = targets.filter(t => t.effect === "INCLUDE");
      if (inclusions.length > 0) {
        let matchedInclusion = false;
        for (const inc of inclusions) {
          if (inc.targetType === "SEARCH_KEYWORD" && context.searchKeyword) {
            const normQuery = context.searchKeyword.toLowerCase().trim();
            if (normQuery.includes(inc.value.toLowerCase())) matchedInclusion = true;
          }
          if (inc.targetType === "CATEGORY" && context.categoryPath) {
            if (context.categoryPath.startsWith(inc.value)) matchedInclusion = true;
          }
          if (inc.targetType === "COLLECTION" && context.collectionSlug) {
            if (context.collectionSlug === inc.value) matchedInclusion = true;
          }
          if (inc.targetType === "PRODUCT_CONTEXT" && context.productContextId) {
            if (context.productContextId === inc.value) matchedInclusion = true;
          }
          if (inc.targetType === "STORE_CONTEXT" && context.storeContextId) {
            if (context.storeContextId === inc.value) matchedInclusion = true;
          }
          if (inc.targetType === "DELIVERY_REGION" && context.deliveryRegionId) {
            if (context.deliveryRegionId === inc.value) matchedInclusion = true;
          }
          if (inc.targetType === "SERVICE_AREA" && context.serviceAreaId) {
            if (context.serviceAreaId === inc.value) matchedInclusion = true;
          }
        }
        if (!matchedInclusion) continue;
      }

      // Frequency cap check
      if (context.sessionFingerprint) {
        if (ver.frequencyCapPerSession) {
          const sessionExposures = await this.db.advertisingServeDecision.count({
            where: {
              campaignVersionId: ver.id,
              sessionFingerprint: context.sessionFingerprint,
              servedAt: { gte: new Date(Date.now() - 3600 * 1000) } // past hour
            }
          });
          if (sessionExposures >= ver.frequencyCapPerSession) continue;
        }
        if (ver.frequencyCapPerDay) {
          const dayExposures = await this.db.advertisingServeDecision.count({
            where: {
              campaignVersionId: ver.id,
              sessionFingerprint: context.sessionFingerprint,
              servedAt: { gte: startOfDay }
            }
          });
          if (dayExposures >= ver.frequencyCapPerDay) continue;
        }
      }

      eligibleVersions.push({
        version: ver,
        dailySpend,
        totalSpend
      });
    }

    if (eligibleVersions.length === 0) {
      return organicResults;
    }

    // 4. Deterministic campaign selection
    const sorted = await Promise.all(
      eligibleVersions.map(async item => {
        const totalExposures = await this.db.advertisingServeDecision.count({
          where: { campaignVersionId: item.version.id }
        });
        const budgetRatio = item.dailySpend.div(item.version.dailyBudget).toNumber();
        return {
          ...item,
          totalExposures,
          budgetRatio
        };
      })
    );

    sorted.sort((a, b) => {
      // 1. Pacing target (lower ratio is better)
      if (a.budgetRatio !== b.budgetRatio) return a.budgetRatio - b.budgetRatio;
      // 2. Fewer exposures
      if (a.totalExposures !== b.totalExposures) return a.totalExposures - b.totalExposures;
      // 3. Earlier approved activation
      const aTime = a.version.activatedAt?.getTime() ?? 0;
      const bTime = b.version.activatedAt?.getTime() ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      // 4. Stable version public reference
      return a.version.publicReference.localeCompare(b.version.publicReference);
    });

    const winnerItem = sorted[0];
    if (!winnerItem) {
      return organicResults;
    }

    const winner = winnerItem.version;
    const creative = winner.creativeSnapshots[0];

    // 5. Create Serve Decision & Token
    const serveDecisionId = `AD-SD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await this.db.advertisingServeDecision.create({
      data: {
        publicReference: serveDecisionId,
        campaignVersionId: winner.id,
        placementDefinitionId: placement.id,
        sessionFingerprint: context.sessionFingerprint ?? null
      }
    });

    const serveToken = AdvertisingServingService.generateSignedToken({
      serveDecisionId,
      campaignVersionId: winner.id,
      placementCode,
      sponsoredObjectType: winner.sponsoredObjectType,
      sponsoredObjectId: (winner.sponsoredObjectType === "PRODUCT" ? winner.sponsoredProductId : winner.sponsoredStoreId)!,
      sessionFingerprint: context.sessionFingerprint ?? "unknown",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000, // 1 hour expiry
      destinationReference: creative?.destinationReference ?? ""
    });

    // 6. Insert candidate into organic results reserved slots
    const resultList: Array<T | { sponsored: true; creative: Record<string, unknown> | null; serveToken: string }> = [];
    for (const item of organicResults) {
      resultList.push(item);
    }
    const creativeData = creative ? (creative as unknown as Record<string, unknown>) : null;
    const adCard = {
      sponsored: true as const,
      creative: creativeData,
      serveToken
    };

    resultList.splice(0, 0, adCard);

    return resultList;
  }
}
