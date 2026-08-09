/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AdvertisingCampaignService, AdvertisingCampaignError } from "@/lib/advertising/campaign.service";
import { AdvertisingClickService } from "@/lib/advertising/click.service";
import { AdvertisingServingService } from "@/lib/advertising/serving.service";
import * as prodLock from "@/lib/advertising/production-lock";
import { createPrismaAdvertisingCampaignVersionRepository, AdvertisingRepositoryError } from "@/lib/advertising/repositories";
import { AdvertisingFundingService, AdvertisingFundingError } from "@/lib/advertising/funding.service";
import { AdvertisingBillingService } from "@/lib/advertising/billing.service";
import { AdvertisingAttributionService } from "@/lib/advertising/attribution.service";
import { AdvertisingReconciliationService } from "@/lib/advertising/reconciliation.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";

// Mock the posting service so it doesn't fail or touch database during unit testing
vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: vi.fn(async () => ({ id: "journal-1" })),
}));

// Mock the wallet/account services
vi.mock("@/lib/services/wallet-account.service", () => ({
  ensureWalletForOwner: vi.fn(async () => ({ id: "platform-wallet-id" })),
  ensureLedgerAccount: vi.fn(async ({ code }) => ({ id: `${code}-id` })),
  getWalletAccount: vi.fn(),
}));

// Mock `@/lib/db/prisma` module by constructing the mock object inside the hoisted factory block
vi.mock("@/lib/db/prisma", () => {
  const localMock = {
    store: {
      findUnique: vi.fn(),
    },
    advertisingAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    advertisingCampaign: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    advertisingCampaignVersion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    advertisingPlacementDefinition: {
      findUnique: vi.fn(),
    },
    advertisingRateCardVersion: {
      findUnique: vi.fn(),
    },
    advertisingTarget: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    advertisingFundingAllocation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    advertisingFundingMovement: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    advertisingMeasurementEvent: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    advertisingClickCharge: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    advertisingDailyAggregate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    advertisingServeDecision: {
      count: vi.fn(),
      create: vi.fn(),
    },
    advertisingAttribution: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    advertisingReconciliationCase: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
    },
    ledgerAccount: {
      findFirst: vi.fn(),
    },
    marketplaceOrder: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(localMock)),
    $queryRaw: vi.fn(),
  };

  (localMock.$transaction as any).mockImplementation((cb: any) => cb(localMock));

  return {
    prisma: localMock,
  };
});

// Import the mocked prisma as mockDb
import { prisma as mockDb } from "@/lib/db/prisma";

describe("Phase 24: Advertising Policy Tests (25 Constraints)", () => {
  const service = new AdvertisingCampaignService(mockDb as any);
  const clickService = new AdvertisingClickService(mockDb as any);

  // Helper to cast mock functions
  const m = (fn: any) => vi.mocked(fn);

  // 1. Only active stores can run/manage campaigns.
  it("Policy 1: Inactive store cannot manage campaigns", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "SUSPENDED" });
    await expect(service.ensureAdvertisingAccount("store-1")).rejects.toThrow(
      AdvertisingCampaignError
    );
  });

  // 2. Suspended stores cannot create drafts.
  it("Policy 2: Suspended store cannot create drafts", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "SUSPENDED" });
    await expect(service.createCampaign("store-1", { name: "Draft Campaign" })).rejects.toThrow(
      /Suspended or inactive stores cannot manage campaigns/
    );
  });

  // 3. Advertised product must belong to the store.
  it("Policy 3: Advertised product must belong to the store", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(mockDb.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", storeId: "store-1" });
    m(mockDb.product.findUnique).mockResolvedValueOnce({ storeId: "store-other", status: "ACTIVE" });

    const versionInput = {
      sponsoredObjectType: "PRODUCT" as const,
      sponsoredProductId: "prod-1",
      placementDefinitionId: "placement-1",
      rateCardVersionId: "rate-1",
      startsAt: new Date(Date.now() + 1000),
      endsAt: new Date(Date.now() + 86400 * 1000),
      dailyBudget: 100,
      totalBudget: 1000,
      targetingPolicyVersion: "1.0",
      measurementPolicyVersion: "1.0",
      invalidTrafficPolicyVersion: "1.0",
      attributionPolicyVersion: "1.0",
      legalTermsVersion: "1.0",
      targets: [],
      creative: {
        creativeType: "CANONICAL_PRODUCT_CARD" as const,
        title: "Title",
        imageAssetReference: "image",
        storeDisplayName: "My Store",
        destinationType: "STOREFRONT",
        destinationReference: "destination",
      },
    };

    await expect(service.createCampaignVersion("store-1", "camp-ref", versionInput)).rejects.toThrow(
      /Advertised product must belong to the store/
    );
  });

  // 4. Product must be published/active to be advertised.
  it("Policy 4: Product must be published to be advertised", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(mockDb.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", storeId: "store-1" });
    m(mockDb.product.findUnique).mockResolvedValueOnce({ storeId: "store-1", status: "DRAFT" }); // not active

    const versionInput = {
      sponsoredObjectType: "PRODUCT" as const,
      sponsoredProductId: "prod-1",
      placementDefinitionId: "placement-1",
      rateCardVersionId: "rate-1",
      startsAt: new Date(Date.now() + 1000),
      endsAt: new Date(Date.now() + 86400 * 1000),
      dailyBudget: 100,
      totalBudget: 1000,
      targetingPolicyVersion: "1.0",
      measurementPolicyVersion: "1.0",
      invalidTrafficPolicyVersion: "1.0",
      attributionPolicyVersion: "1.0",
      legalTermsVersion: "1.0",
      targets: [],
      creative: {
        creativeType: "CANONICAL_PRODUCT_CARD" as const,
        title: "Title",
        imageAssetReference: "image",
        storeDisplayName: "My Store",
        destinationType: "STOREFRONT",
        destinationReference: "destination",
      },
    };

    await expect(service.createCampaignVersion("store-1", "camp-ref", versionInput)).rejects.toThrow(
      /Advertised product must be published and active/
    );
  });

  // 5. Placement definition must support the sponsored object type.
  it("Policy 5: Placement definition must support the object type", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(mockDb.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", storeId: "store-1" });
    m(mockDb.product.findUnique).mockResolvedValueOnce({ storeId: "store-1", status: "ACTIVE" });
    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({
      id: "placement-1",
      status: "ACTIVE",
      sponsoredObjectType: "STORE", // mismatch with PRODUCT
    });

    const versionInput = {
      sponsoredObjectType: "PRODUCT" as const,
      sponsoredProductId: "prod-1",
      placementDefinitionId: "placement-1",
      rateCardVersionId: "rate-1",
      startsAt: new Date(Date.now() + 1000),
      endsAt: new Date(Date.now() + 86400 * 1000),
      dailyBudget: 100,
      totalBudget: 1000,
      targetingPolicyVersion: "1.0",
      measurementPolicyVersion: "1.0",
      invalidTrafficPolicyVersion: "1.0",
      attributionPolicyVersion: "1.0",
      legalTermsVersion: "1.0",
      targets: [],
      creative: {
        creativeType: "CANONICAL_PRODUCT_CARD" as const,
        title: "Title",
        imageAssetReference: "image",
        storeDisplayName: "My Store",
        destinationType: "STOREFRONT",
        destinationReference: "destination",
      },
    };

    await expect(service.createCampaignVersion("store-1", "camp-ref", versionInput)).rejects.toThrow(
      /Selected placement does not support the object type/
    );
  });

  // 6. Active campaign versions are immutable.
  it("Policy 6: Active versions are immutable", async () => {
    const repo = createPrismaAdvertisingCampaignVersionRepository(mockDb as any);
    m(mockDb.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      status: "RETIRED"
    });
    await expect(repo.updateStatus("ver-1", "ACTIVE")).rejects.toThrow(AdvertisingRepositoryError);

    m(mockDb.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-2",
      status: "ACTIVE"
    });
    await expect(repo.assertImmutable("ver-2")).rejects.toThrow(AdvertisingRepositoryError);
  });

  // 7. Daily budget cannot exceed total budget.
  it("Policy 7: Daily budget cannot exceed total budget", async () => {
    m(mockDb.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(mockDb.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", storeId: "store-1" });
    m(mockDb.product.findUnique).mockResolvedValueOnce({ storeId: "store-1", status: "ACTIVE" });
    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({
      id: "placement-1",
      status: "ACTIVE",
      sponsoredObjectType: "PRODUCT",
    });
    m(mockDb.advertisingRateCardVersion.findUnique).mockResolvedValueOnce({
      id: "rate-1",
      status: "ACTIVE",
      placementDefinitionId: "placement-1",
      minimumCampaignFunding: 200,
    });

    const versionInput = {
      sponsoredObjectType: "PRODUCT" as const,
      sponsoredProductId: "prod-1",
      placementDefinitionId: "placement-1",
      rateCardVersionId: "rate-1",
      startsAt: new Date(Date.now() + 1000),
      endsAt: new Date(Date.now() + 86400 * 1000),
      dailyBudget: 1500, // exceeds total budget 1000
      totalBudget: 1000,
      targetingPolicyVersion: "1.0",
      measurementPolicyVersion: "1.0",
      invalidTrafficPolicyVersion: "1.0",
      attributionPolicyVersion: "1.0",
      legalTermsVersion: "1.0",
      targets: [],
      creative: {
        creativeType: "CANONICAL_PRODUCT_CARD" as const,
        title: "Title",
        imageAssetReference: "image",
        storeDisplayName: "My Store",
        destinationType: "STOREFRONT",
        destinationReference: "destination",
      },
    };

    await expect(service.createCampaignVersion("store-1", "camp-ref", versionInput)).rejects.toThrow(
      /Daily budget cannot exceed total budget/
    );
  });

  // 8. Campaign funding must meet rate card minimum campaign funding.
  it("Policy 8: Funding must meet rate card minimum", async () => {
    const fundService = new AdvertisingFundingService();
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      campaignId: "camp-1",
      campaign: { id: "camp-1", name: "Summer Campaign", storeId: "store-1", status: "APPROVED" },
      rateCardVersion: { id: "rc-1", minimumCampaignFunding: new Prisma.Decimal(200) }
    });
    
    await expect(fundService.fundCampaign({
      campaignVersionId: "ver-1",
      storeId: "store-1",
      amount: 100, // Under 200 limit
      actorUserId: "user-1",
      operationId: "op-1",
      requestHash: "hash-1"
    })).rejects.toThrow(/Funding amount must be at least/);
  });

  // 9. Exclusion targets filter out campaigns.
  it("Policy 9: Exclusion targets filter out campaigns", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    
    const now = new Date();
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(100) }],
        creativeSnapshots: [{ destinationReference: "/prod-1" }]
      }
    ]);

    m(mockDb.advertisingClickCharge.aggregate).mockResolvedValue({ _sum: { chargeAmount: new Prisma.Decimal(0) } });
    
    // Mock exclusion target on "spam"
    m(mockDb.advertisingTarget.findMany).mockResolvedValueOnce([
      { targetType: "SEARCH_KEYWORD", effect: "EXCLUDE", value: "spam" }
    ]);

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      searchKeyword: "buy some spam today",
      sessionFingerprint: "finger-1"
    });

    expect(results).toEqual(organic);
  });

  // 10. Inclusion targets must match at least one target to serve.
  it("Policy 10: Inclusion targets must match to serve", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(100) }],
        creativeSnapshots: [{ destinationReference: "/prod-1" }]
      }
    ]);

    m(mockDb.advertisingClickCharge.aggregate).mockResolvedValue({ _sum: { chargeAmount: new Prisma.Decimal(0) } });
    
    // Mock inclusion target (looking for "tea" but query is "coffee")
    m(mockDb.advertisingTarget.findMany).mockResolvedValueOnce([
      { targetType: "SEARCH_KEYWORD", effect: "INCLUDE", value: "tea" }
    ]);

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      searchKeyword: "organic coffee",
      sessionFingerprint: "finger-1"
    });

    expect(results).toEqual(organic);
  });

  // 11. Search keyword targeting uses synonym/case-insensitive queries.
  it("Policy 11: Search keyword targeting is case-insensitive", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(100) }],
        creativeSnapshots: [{ destinationReference: "/prod-1" }],
        activatedAt: new Date()
      }
    ]);

    m(mockDb.advertisingClickCharge.aggregate).mockResolvedValue({ _sum: { chargeAmount: new Prisma.Decimal(0) } });
    m(mockDb.advertisingTarget.findMany).mockResolvedValueOnce([
      { targetType: "SEARCH_KEYWORD", effect: "INCLUDE", value: "TEA" } // Uppercase target
    ]);
    m(mockDb.advertisingServeDecision.count).mockResolvedValue(0);
    m(mockDb.advertisingServeDecision.create).mockResolvedValueOnce({ id: "sd-1" });

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      searchKeyword: "green tea ", // lowercase with space
      sessionFingerprint: "finger-1"
    });

    expect(results.length).toBe(2);
    expect(results[0]).toHaveProperty("sponsored", true);
  });

  // 12. Frequency caps restrict exposures per session.
  it("Policy 12: Frequency caps restrict exposures per session", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(100) }],
        creativeSnapshots: [{ destinationReference: "/prod-1" }],
        frequencyCapPerSession: 3
      }
    ]);

    m(mockDb.advertisingClickCharge.aggregate).mockResolvedValue({ _sum: { chargeAmount: new Prisma.Decimal(0) } });
    m(mockDb.advertisingTarget.findMany).mockResolvedValueOnce([]);
    
    // Mock session exposures count >= 3
    m(mockDb.advertisingServeDecision.count).mockResolvedValueOnce(3);

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      sessionFingerprint: "finger-1"
    });

    expect(results).toEqual(organic);
  });

  // 13. Frequency caps restrict exposures per day.
  it("Policy 13: Frequency caps restrict exposures per day", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(100) }],
        creativeSnapshots: [{ destinationReference: "/prod-1" }],
        frequencyCapPerSession: 3,
        frequencyCapPerDay: 5
      }
    ]);

    m(mockDb.advertisingClickCharge.aggregate).mockResolvedValue({ _sum: { chargeAmount: new Prisma.Decimal(0) } });
    m(mockDb.advertisingTarget.findMany).mockResolvedValueOnce([]);
    
    // session check (0 exposures, under 3 limit), daily check (5 exposures, exceeds 5 limit)
    m(mockDb.advertisingServeDecision.count)
      .mockResolvedValueOnce(0) // session
      .mockResolvedValueOnce(5); // day

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      sessionFingerprint: "finger-1"
    });

    expect(results).toEqual(organic);
  });

  // 14. Click velocity checks block rapid double clicks.
  it("Policy 14: Click velocity checks block rapid double clicks", async () => {
    m(mockDb.advertisingMeasurementEvent.findFirst).mockResolvedValueOnce({ id: "click-1" }); // click within 1 sec exists
    const result = await clickService.classifyClick(
      {
        serveDecisionId: "serve-1",
        campaignVersionId: "ver-1",
        placementCode: "pl-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredObjectId: "prod-1",
        sessionFingerprint: "finger-1",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        destinationReference: "dest",
      },
      "finger-1"
    );
    expect(result.classification).toBe("INVALID");
    expect(result.reason).toBe("VELOCITY_VIOLATION");
  });

  // 15. Bot filtering blocks bot user agents.
  it("Policy 15: Bot filtering blocks bot user agents", async () => {
    const result = await clickService.classifyClick(
      {
        serveDecisionId: "serve-1",
        campaignVersionId: "ver-1",
        placementCode: "pl-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredObjectId: "prod-1",
        sessionFingerprint: "finger-1",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        destinationReference: "dest",
      },
      "finger-1",
      "bot"
    );
    expect(result.classification).toBe("INVALID");
    expect(result.reason).toBe("BOT_OR_CRAWLER");
  });

  // 16. Click deduplication window marks duplicates as non-billable.
  it("Policy 16: Click deduplication window marks duplicates as non-billable", async () => {
    m(mockDb.advertisingMeasurementEvent.findFirst)
      .mockResolvedValueOnce(null) // no velocity check match
      .mockResolvedValueOnce({ id: "existing-click" }); // duplicate check match

    const result = await clickService.classifyClick(
      {
        serveDecisionId: "serve-1",
        campaignVersionId: "ver-1",
        placementCode: "pl-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredObjectId: "prod-1",
        sessionFingerprint: "finger-1",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        destinationReference: "dest",
      },
      "finger-1"
    );
    expect(result.classification).toBe("VALID_NON_BILLABLE");
    expect(result.reason).toBe("DUPLICATE_CLICK");
  });

  // 17. Exhausted funding stops ad serving.
  it("Policy 17: Exhausted funding stops ad serving", async () => {
    const servingService = new AdvertisingServingService(mockDb as any);
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE" });
    m(mockDb.advertisingCampaignVersion.findMany).mockResolvedValueOnce([
      {
        id: "ver-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredProductId: "prod-1",
        placementDefinitionId: "pl-1",
        dailyBudget: new Prisma.Decimal(100),
        totalBudget: new Prisma.Decimal(1000),
        campaign: { status: "ACTIVE", store: { status: "ACTIVE", name: "Store 1" } },
        product: { status: "ACTIVE" },
        fundingAllocations: [{ remainingAmount: new Prisma.Decimal(0) }], // 0 funds remaining
        creativeSnapshots: [{ destinationReference: "/prod-1" }]
      }
    ]);

    const organic = [{ id: "prod-2" }];
    const results = await servingService.composeSponsoredMarketplacePlacements(organic, "pl-code", {
      sessionFingerprint: "finger-1"
    });

    expect(results).toEqual(organic);
  });

  // 18. Exhausted funding marks clicks as non-billable.
  it("Policy 18: Exhausted funding marks clicks as non-billable", async () => {
    m(mockDb.advertisingMeasurementEvent.findFirst)
      .mockResolvedValueOnce(null) // velocity
      .mockResolvedValueOnce(null); // duplicate

    m(mockDb.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      status: "ACTIVE",
      fundingAllocations: [
        { remainingAmount: new Prisma.Decimal(0) }
      ]
    });

    const result = await clickService.classifyClick(
      {
        serveDecisionId: "serve-1",
        campaignVersionId: "ver-1",
        placementCode: "pl-1",
        sponsoredObjectType: "PRODUCT",
        sponsoredObjectId: "prod-1",
        sessionFingerprint: "finger-1",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600 * 1000,
        destinationReference: "dest",
      },
      "finger-1"
    );

    expect(result.classification).toBe("VALID_NON_BILLABLE");
    expect(result.reason).toBe("EXHAUSTED_FUNDING");
  });

  // 19. Reversal posts exact refund ledger entry.
  it("Policy 19: Reversal posts exact refund ledger entry", async () => {
    const billingService = new AdvertisingBillingService();
    vi.spyOn(prodLock, "assertAdvertisingProductionReady").mockImplementationOnce(() => {});

    m(mockDb.advertisingClickCharge.findUnique).mockResolvedValueOnce({
      id: "charge-1",
      publicReference: "REF-CHG-1",
      status: "CHARGED",
      chargeAmount: new Prisma.Decimal(5.5),
      fundingAllocationId: "alloc-1",
      campaignVersionId: "ver-1",
      chargedAt: new Date()
    });

    m(mockDb.advertisingFundingAllocation.findUnique).mockResolvedValueOnce({
      id: "alloc-1",
      remainingAmount: new Prisma.Decimal(10),
      spentAmount: new Prisma.Decimal(5.5),
      status: "PARTIALLY_SPENT"
    });

    m(mockDb.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      placementDefinitionId: "pl-1"
    });

    await billingService.reverseClick({
      clickChargeId: "charge-1",
      reason: "INVALID_BOT",
      actorUserId: "admin-1",
      operationId: "op-rev-1",
      requestHash: "hash-rev-1"
    });

    expect(postLedgerJournalWithinTransaction).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      idempotencyKey: "AD-REV-JRN-op-rev-1",
      entries: expect.arrayContaining([
        expect.objectContaining({ direction: "DEBIT", amount: "5.50" }),
        expect.objectContaining({ direction: "CREDIT", amount: "5.50" })
      ])
    }));
  });

  // 20. Reconciliation logs click charge without event.
  it("Policy 20: Reconciliation logs click charge without event", async () => {
    const reconciliationService = new AdvertisingReconciliationService(mockDb as any);
    
    m(mockDb.advertisingClickCharge.findMany).mockResolvedValueOnce([
      {
        id: "charge-1",
        publicReference: "CHG-1",
        measurementEvent: { validityStatus: "INVALID" }
      }
    ]);
    m(mockDb.advertisingMeasurementEvent.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingCampaign.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingReconciliationCase.findFirst).mockResolvedValueOnce(null);
    m(mockDb.advertisingReconciliationCase.create).mockResolvedValueOnce({ id: "case-1" });

    const cases = await reconciliationService.scanForReconciliationDiscrepancies();
    expect(cases.length).toBe(1);
    expect(mockDb.advertisingReconciliationCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reason: "CLICK_CHARGE_WITHOUT_VALID_EVENT"
      })
    }));
  });

  // 21. Reconciliation logs valid click without charge.
  it("Policy 21: Reconciliation logs valid click without charge", async () => {
    const reconciliationService = new AdvertisingReconciliationService(mockDb as any);

    m(mockDb.advertisingClickCharge.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingMeasurementEvent.findMany).mockResolvedValueOnce([
      {
        id: "event-1",
        publicReference: "EVT-1",
        eventType: "CLICK",
        validityStatus: "VALID",
        campaignVersionId: "ver-1"
      }
    ]);
    m(mockDb.advertisingFundingAllocation.findMany).mockResolvedValueOnce([
      { remainingAmount: new Prisma.Decimal(100) }
    ]);
    m(mockDb.advertisingCampaign.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingReconciliationCase.findFirst).mockResolvedValueOnce(null);
    m(mockDb.advertisingReconciliationCase.create).mockResolvedValueOnce({ id: "case-1" });

    const cases = await reconciliationService.scanForReconciliationDiscrepancies();
    expect(cases.length).toBe(1);
    expect(mockDb.advertisingReconciliationCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reason: "VALID_CLICK_WITHOUT_CHARGE"
      })
    }));
  });

  // 22. Reconciliation logs budget overruns.
  it("Policy 22: Reconciliation logs budget overruns", async () => {
    const reconciliationService = new AdvertisingReconciliationService(mockDb as any);

    m(mockDb.advertisingClickCharge.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingMeasurementEvent.findMany).mockResolvedValueOnce([]);
    m(mockDb.advertisingCampaign.findMany).mockResolvedValueOnce([
      {
        id: "camp-1",
        versions: [
          {
            id: "ver-1",
            publicReference: "VER-REF-1",
            totalBudget: new Prisma.Decimal(100),
            clickCharges: [
              { id: "chg-1", chargeAmount: new Prisma.Decimal(60) },
              { id: "chg-2", chargeAmount: new Prisma.Decimal(50) }
            ]
          }
        ]
      }
    ]);
    m(mockDb.advertisingReconciliationCase.findFirst).mockResolvedValueOnce(null);
    m(mockDb.advertisingReconciliationCase.create).mockResolvedValueOnce({ id: "case-1" });

    const cases = await reconciliationService.scanForReconciliationDiscrepancies();
    expect(cases.length).toBe(1);
    expect(mockDb.advertisingReconciliationCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reason: "CAMPAIGN_BUDGET_OVERRUN"
      })
    }));
  });

  // 23. Conversion attribution requires canonical consented click evidence.
  it("Policy 23: Conversion attribution never infers a checkout session identity", async () => {
    const attributionService = new AdvertisingAttributionService();
    await attributionService.attributeOrder("order-1");
    expect(mockDb.marketplaceOrder.findUnique).not.toHaveBeenCalled();
    expect(mockDb.advertisingMeasurementEvent.findMany).not.toHaveBeenCalled();
    expect(mockDb.advertisingAttribution.create).not.toHaveBeenCalled();
  });

  // 24. An order reference alone is not conversion-attribution evidence.
  it("Policy 24: Order identity alone cannot create attribution", async () => {
    const attributionService = new AdvertisingAttributionService();
    await attributionService.attributeOrder("order-1");
    expect(mockDb.advertisingAttribution.create).not.toHaveBeenCalled();
  });

  // 25. HMAC token signature verification prevents falsified clicks.
  it("Policy 25: HMAC token signature verification prevents falsified clicks", () => {
    const payload = {
      serveDecisionId: "serve-1",
      campaignVersionId: "ver-1",
      placementCode: "pl-1",
      sponsoredObjectType: "PRODUCT",
      sponsoredObjectId: "prod-1",
      sessionFingerprint: "finger-1",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000,
      destinationReference: "dest",
    };
    const token = AdvertisingServingService.generateSignedToken(payload);
    const verified = AdvertisingServingService.verifySignedToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.serveDecisionId).toBe("serve-1");

    const falsifiedToken = token + "modified";
    const failedVerify = AdvertisingServingService.verifySignedToken(falsifiedToken);
    expect(failedVerify).toBeNull();
  });

  // Production lock validation check
  it("assertAdvertisingProductionReady raises locked error if not approved", () => {
    expect(() => prodLock.assertAdvertisingProductionReady("CAMPAIGN_ACTIVATE")).toThrow(
      prodLock.AdvertisingProductionLockedError
    );
  });
});
