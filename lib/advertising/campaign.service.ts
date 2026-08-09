import { prisma } from "@/lib/db/prisma";
import { Prisma, StoreStatus, ProductStatus, AdvertisingCampaignStatus, AdvertisingCampaignVersionStatus, AdvertisingPlacementStatus, AdvertisingRateCardStatus } from "@prisma/client";
import { assertAdvertisingProductionReady } from "./production-lock";

export class AdvertisingCampaignError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AdvertisingCampaignError";
  }
}

export type CreateCampaignInput = {
  name: string;
};

export type CreateCampaignVersionInput = {
  sponsoredObjectType: "PRODUCT" | "STORE";
  sponsoredProductId?: string | null;
  sponsoredStoreId?: string | null;
  placementDefinitionId: string;
  rateCardVersionId: string;
  startsAt: Date;
  endsAt: Date;
  dailyBudget: number;
  totalBudget: number;
  attributionWindowDays?: number;
  frequencyCapPerSession?: number | null;
  frequencyCapPerDay?: number | null;
  targetingPolicyVersion: string;
  measurementPolicyVersion: string;
  invalidTrafficPolicyVersion: string;
  attributionPolicyVersion: string;
  legalTermsVersion: string;
  targets: Array<{ targetType: string; value: string; effect: "INCLUDE" | "EXCLUDE" }>;
  creative: {
    creativeType: "CANONICAL_PRODUCT_CARD" | "CANONICAL_STORE_CARD";
    productId?: string | null;
    productVersionReference?: string | null;
    offerReference?: string | null;
    storeId?: string | null;
    title: string;
    imageAssetReference: string;
    safePriceSnapshot?: number | null;
    storeDisplayName: string;
    disclosureLabel?: string;
    destinationType: string;
    destinationReference: string;
  };
};

export class AdvertisingCampaignService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  private transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.tx ? work(this.tx) : prisma.$transaction(work);
  }

  private async assertStoreActive(storeId: string) {
    const store = await this.db.store.findUnique({
      where: { id: storeId },
      select: { status: true }
    });
    if (!store) {
      throw new AdvertisingCampaignError("STORE_NOT_FOUND", "Store was not found.");
    }
    if (store.status !== StoreStatus.ACTIVE) {
      throw new AdvertisingCampaignError("STORE_INACTIVE", "Suspended or inactive stores cannot manage campaigns.");
    }
  }

  async ensureAdvertisingAccount(storeId: string) {
    await this.assertStoreActive(storeId);
    let account = await this.db.advertisingAccount.findUnique({
      where: { storeId }
    });
    if (!account) {
      const publicReference = `AD-ACC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      account = await this.db.advertisingAccount.create({
        data: {
          publicReference,
          storeId,
          status: "ACTIVE",
          billingStatus: "ACTIVE",
          moderationStatus: "APPROVED"
        }
      });
    }
    return account;
  }

  async createCampaign(storeId: string, input: CreateCampaignInput) {
    const account = await this.ensureAdvertisingAccount(storeId);
    const publicReference = `AD-CMP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    return this.db.advertisingCampaign.create({
      data: {
        publicReference,
        advertisingAccountId: account.id,
        storeId,
        name: input.name,
        status: AdvertisingCampaignStatus.DRAFT
      }
    });
  }

  async getCampaignByRef(storeId: string, publicReference: string) {
    const campaign = await this.db.advertisingCampaign.findFirst({
      where: { publicReference, storeId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            creativeSnapshots: true
          }
        }
      }
    });
    if (!campaign) {
      throw new AdvertisingCampaignError("CAMPAIGN_NOT_FOUND", "Campaign was not found.");
    }
    return campaign;
  }

  async updateCampaign(storeId: string, publicReference: string, input: { name?: string }) {
    const campaign = await this.getCampaignByRef(storeId, publicReference);
    if (campaign.status !== AdvertisingCampaignStatus.DRAFT && campaign.status !== AdvertisingCampaignStatus.UNDER_REVIEW) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Only draft or under review campaigns can be renamed.");
    }
    return this.db.advertisingCampaign.update({
      where: { id: campaign.id },
      data: {
        name: input.name ?? campaign.name
      }
    });
  }

  async createCampaignVersion(
    storeId: string,
    campaignPublicReference: string,
    input: CreateCampaignVersionInput
  ) {
    const campaign = await this.getCampaignByRef(storeId, campaignPublicReference);
    
    // Check if store is active
    await this.assertStoreActive(storeId);

    // Validate objective & object ownership
    if (input.sponsoredObjectType === "PRODUCT") {
      if (!input.sponsoredProductId) {
        throw new AdvertisingCampaignError("PRODUCT_REQUIRED", "Sponsored product ID is required.");
      }
      const product = await this.db.product.findUnique({
        where: { id: input.sponsoredProductId },
        select: { storeId: true, status: true }
      });
      if (!product || product.storeId !== storeId) {
        throw new AdvertisingCampaignError("PRODUCT_OWNERSHIP_MISMATCH", "Advertised product must belong to the store.");
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new AdvertisingCampaignError("PRODUCT_NOT_ELIGIBLE", "Advertised product must be published and active.");
      }
    } else {
      if (!input.sponsoredStoreId || input.sponsoredStoreId !== storeId) {
        throw new AdvertisingCampaignError("STORE_OWNERSHIP_MISMATCH", "Advertised store must equal campaign store.");
      }
    }

    // Validate placement and Rate Card compatibility
    const placement = await this.db.advertisingPlacementDefinition.findUnique({
      where: { id: input.placementDefinitionId }
    });
    if (!placement || placement.status !== AdvertisingPlacementStatus.ACTIVE) {
      throw new AdvertisingCampaignError("PLACEMENT_INACTIVE", "Selected placement definition is inactive.");
    }
    if (placement.sponsoredObjectType !== input.sponsoredObjectType) {
      throw new AdvertisingCampaignError("PLACEMENT_OBJECT_MISMATCH", "Selected placement does not support the object type.");
    }

    const rateCard = await this.db.advertisingRateCardVersion.findUnique({
      where: { id: input.rateCardVersionId }
    });
    if (!rateCard || rateCard.placementDefinitionId !== placement.id || rateCard.status !== AdvertisingRateCardStatus.ACTIVE) {
      throw new AdvertisingCampaignError("RATE_CARD_INVALID", "Selected rate card is invalid or inactive.");
    }

    // Validate budgets
    if (input.dailyBudget <= 0 || input.totalBudget <= 0) {
      throw new AdvertisingCampaignError("INVALID_BUDGET", "Budgets must be positive.");
    }
    if (input.dailyBudget > input.totalBudget) {
      throw new AdvertisingCampaignError("BUDGET_CONSTRAINT_VIOLATION", "Daily budget cannot exceed total budget.");
    }

    // Validate dates
    if (input.startsAt >= input.endsAt) {
      throw new AdvertisingCampaignError("INVALID_DATES", "Campaign start date must be before end date.");
    }

    // Determine version number
    const maxVersion = await this.db.advertisingCampaignVersion.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true }
    });
    const versionNumber = (maxVersion?.versionNumber ?? 0) + 1;

    const publicRef = `AD-VER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create version & targets & creatives inside database
    const createdVersion = await this.db.advertisingCampaignVersion.create({
      data: {
        publicReference: publicRef,
        campaignId: campaign.id,
        versionNumber,
        status: AdvertisingCampaignVersionStatus.DRAFT,
        sponsoredObjectType: input.sponsoredObjectType,
        sponsoredProductId: input.sponsoredProductId,
        sponsoredStoreId: input.sponsoredStoreId,
        placementDefinitionId: placement.id,
        rateCardVersionId: rateCard.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        dailyBudget: new Prisma.Decimal(input.dailyBudget),
        totalBudget: new Prisma.Decimal(input.totalBudget),
        attributionWindowDays: input.attributionWindowDays ?? 14,
        frequencyCapPerSession: input.frequencyCapPerSession,
        frequencyCapPerDay: input.frequencyCapPerDay,
        targetingPolicyVersion: input.targetingPolicyVersion,
        measurementPolicyVersion: input.measurementPolicyVersion,
        invalidTrafficPolicyVersion: input.invalidTrafficPolicyVersion,
        attributionPolicyVersion: input.attributionPolicyVersion,
        legalTermsVersion: input.legalTermsVersion,
        creativeSnapshots: {
          create: {
            publicReference: `AD-CRT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            creativeType: input.creative.creativeType,
            productId: input.creative.productId,
            productVersionReference: input.creative.productVersionReference,
            offerReference: input.creative.offerReference,
            storeId: input.creative.storeId,
            title: input.creative.title,
            imageAssetReference: input.creative.imageAssetReference,
            safePriceSnapshot: input.creative.safePriceSnapshot ? new Prisma.Decimal(input.creative.safePriceSnapshot) : null,
            storeDisplayName: input.creative.storeDisplayName,
            disclosureLabel: input.creative.disclosureLabel ?? "Sponsored",
            destinationType: input.creative.destinationType,
            destinationReference: input.creative.destinationReference
          }
        }
      },
      include: {
        creativeSnapshots: true
      }
    });

    // Create targets
    if (input.targets && input.targets.length > 0) {
      await this.db.advertisingTarget.createMany({
        data: input.targets.map(target => ({
          campaignVersionId: createdVersion.id,
          targetType: target.targetType,
          value: target.value,
          effect: target.effect
        }))
      });
    }

    return createdVersion;
  }

  async submitCampaignForReview(storeId: string, campaignPublicReference: string) {
    const campaign = await this.getCampaignByRef(storeId, campaignPublicReference);
    if (campaign.status !== AdvertisingCampaignStatus.DRAFT && campaign.status !== AdvertisingCampaignStatus.REJECTED) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Only draft or rejected campaigns can be submitted.");
    }
    
    // Validate we have at least one version
    const latestVersion = await this.db.advertisingCampaignVersion.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { versionNumber: "desc" }
    });
    if (!latestVersion) {
      throw new AdvertisingCampaignError("VERSION_REQUIRED", "At least one campaign version is required before submission.");
    }

    return this.db.advertisingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: AdvertisingCampaignStatus.UNDER_REVIEW
      }
    });
  }

  async moderateCampaign(
    campaignPublicReference: string,
    action: "APPROVE" | "REJECT",
    moderatorUserId: string,
    rejectionReason?: string
  ) {
    const campaign = await this.db.advertisingCampaign.findUnique({
      where: { publicReference: campaignPublicReference },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });
    if (!campaign) {
      throw new AdvertisingCampaignError("CAMPAIGN_NOT_FOUND", "Campaign was not found.");
    }
    if (campaign.status !== AdvertisingCampaignStatus.UNDER_REVIEW) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Campaign is not under review.");
    }

    const version = campaign.versions[0];
    if (!version) {
      throw new AdvertisingCampaignError("VERSION_REQUIRED", "No campaign version found to moderate.");
    }

    if (action === "APPROVE") {
      return this.transaction(async (tx) => {
        await tx.advertisingCampaignVersion.update({
          where: { id: version.id },
          data: {
            approvedByUserId: moderatorUserId,
            approvedAt: new Date()
          }
        });
        return tx.advertisingCampaign.update({
          where: { id: campaign.id },
          data: {
            status: AdvertisingCampaignStatus.APPROVED
          }
        });
      });
    } else {
      return this.transaction(async (tx) => {
        await tx.advertisingCampaignVersion.update({
          where: { id: version.id },
          data: {
            rejectedAt: new Date(),
            rejectionReason: rejectionReason ?? "Rejected during admin moderation."
          }
        });
        return tx.advertisingCampaign.update({
          where: { id: campaign.id },
          data: {
            status: AdvertisingCampaignStatus.REJECTED
          }
        });
      });
    }
  }

  async activateCampaign(campaignPublicReference: string) {
    // Check production readiness
    assertAdvertisingProductionReady("CAMPAIGN_ACTIVATE");

    const campaign = await this.db.advertisingCampaign.findUnique({
      where: { publicReference: campaignPublicReference },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });
    if (!campaign) {
      throw new AdvertisingCampaignError("CAMPAIGN_NOT_FOUND", "Campaign was not found.");
    }

    // Must be APPROVED or FUNDED or SCHEDULED or PAUSED
    const allowed: readonly AdvertisingCampaignStatus[] = [
      AdvertisingCampaignStatus.APPROVED,
      AdvertisingCampaignStatus.FUNDED,
      AdvertisingCampaignStatus.SCHEDULED,
      AdvertisingCampaignStatus.PAUSED
    ];
    if (!allowed.includes(campaign.status)) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Campaign cannot be activated in its current state.");
    }

    const version = campaign.versions[0];
    if (!version) {
      throw new AdvertisingCampaignError("VERSION_REQUIRED", "No campaign version found to activate.");
    }

    // Check if there is funding allocated
    const funding = await this.db.advertisingFundingAllocation.findFirst({
      where: { campaignVersionId: version.id, status: "FUNDED" }
    });
    if (!funding) {
      throw new AdvertisingCampaignError("FUNDING_REQUIRED", "Campaign must have funding allocated before activation.");
    }

    return this.transaction(async (tx) => {
      await tx.advertisingCampaignVersion.update({
        where: { id: version.id },
        data: {
          status: AdvertisingCampaignVersionStatus.ACTIVE,
          activatedAt: new Date()
        }
      });
      return tx.advertisingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: AdvertisingCampaignStatus.ACTIVE
        }
      });
    });
  }

  async pauseCampaign(storeId: string, campaignPublicReference: string) {
    const campaign = await this.getCampaignByRef(storeId, campaignPublicReference);
    if (campaign.status !== AdvertisingCampaignStatus.ACTIVE) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Only active campaigns can be paused.");
    }
    const version = campaign.versions[0];
    if (!version) throw new AdvertisingCampaignError("VERSION_REQUIRED", "No active version found.");

    return this.transaction(async (tx) => {
      await tx.advertisingCampaignVersion.update({
        where: { id: version.id },
        data: {
          pausedAt: new Date()
        }
      });
      return tx.advertisingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: AdvertisingCampaignStatus.PAUSED
        }
      });
    });
  }

  async endCampaign(storeId: string, campaignPublicReference: string) {
    const campaign = await this.getCampaignByRef(storeId, campaignPublicReference);
    const endable: readonly AdvertisingCampaignStatus[] = [AdvertisingCampaignStatus.ACTIVE, AdvertisingCampaignStatus.PAUSED, AdvertisingCampaignStatus.EXHAUSTED];
    if (!endable.includes(campaign.status)) {
      throw new AdvertisingCampaignError("INVALID_STATUS", "Only active, paused or exhausted campaigns can be ended.");
    }
    const version = campaign.versions[0];
    if (!version) throw new AdvertisingCampaignError("VERSION_REQUIRED", "No active version found.");

    return this.transaction(async (tx) => {
      await tx.advertisingCampaignVersion.update({
        where: { id: version.id },
        data: {
          endedAt: new Date()
        }
      });
      return tx.advertisingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: AdvertisingCampaignStatus.ENDED
        }
      });
    });
  }

  async suspendCampaignByAdmin(campaignPublicReference: string) {
    const campaign = await this.db.advertisingCampaign.findUnique({
      where: { publicReference: campaignPublicReference }
    });
    if (!campaign) {
      throw new AdvertisingCampaignError("CAMPAIGN_NOT_FOUND", "Campaign was not found.");
    }
    return this.db.advertisingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: AdvertisingCampaignStatus.SUSPENDED
      }
    });
  }
}
