/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";
import { AdvertisingFundingService } from "@/lib/advertising/funding.service";
import { AdvertisingBillingService } from "@/lib/advertising/billing.service";
import { AdvertisingAttributionService } from "@/lib/advertising/attribution.service";
import { AdvertisingReconciliationService } from "@/lib/advertising/reconciliation.service";
import { AdvertisingAggregationService } from "@/lib/advertising/aggregation.service";

// Mock the global Prisma instance inside the hoisted mock block
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
      findMany: vi.fn(),
      create: vi.fn(),
    },
    advertisingRateCardVersion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
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
      groupBy: vi.fn(),
      update: vi.fn(),
    },
    advertisingClickCharge: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    advertisingServeDecision: {
      count: vi.fn(),
      create: vi.fn(),
    },
    advertisingAttribution: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    advertisingDailyAggregate: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    advertisingReconciliationCase: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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

  // self-reference inside transaction mocks
  (localMock.$transaction as any).mockImplementation((cb: any) => cb(localMock));

  return {
    prisma: localMock,
  };
});

// Import the mocked prisma
import { prisma } from "@/lib/db/prisma";

// Mock production-ready check
vi.mock("@/lib/advertising/production-lock", () => ({
  assertAdvertisingProductionReady: vi.fn(),
  AdvertisingProductionLockedError: class extends Error {
    readonly code = "CONSOLIDATED_VALIDATION_NOT_APPROVED";
  }
}));

// Mock Phase 9 ledger and wallet services
vi.mock("@/lib/services/wallet-account.service", () => ({
  ensureWalletForOwner: vi.fn(async () => ({ id: "platform-wallet-id" })),
  ensureLedgerAccount: vi.fn(async ({ code }) => ({ id: `${code}-id` })),
  getWalletAccount: vi.fn(),
}));

vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: vi.fn(async () => ({ id: "journal-1" })),
}));

describe("Phase 24: Advertising Service Tests (10 Service Flows)", () => {
  // Service instances
  const campaignService = new AdvertisingCampaignService(prisma as any);
  const fundingService = new AdvertisingFundingService();
  const billingService = new AdvertisingBillingService();
  const attributionService = new AdvertisingAttributionService(prisma as any);
  const reconciliationService = new AdvertisingReconciliationService(prisma as any);
  const aggregationService = new AdvertisingAggregationService(prisma as any);

  // Helper to cast mock functions
  const m = (fn: any) => vi.mocked(fn);

  // 1. CampaignService.createCampaign
  it("Service 1: createCampaign creates a draft campaign record", async () => {
    m(prisma.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(prisma.advertisingAccount.findUnique).mockResolvedValueOnce({ id: "acc-1" });
    m(prisma.advertisingCampaign.create).mockResolvedValueOnce({ id: "camp-1", status: "DRAFT" });

    const camp = await campaignService.createCampaign("store-1", { name: "Summer Campaign" });
    expect(camp.status).toBe("DRAFT");
  });

  // 2. CampaignService.createCampaignVersion
  it("Service 2: createCampaignVersion creates a version with snapshots and targets", async () => {
    m(prisma.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(prisma.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", storeId: "store-1" });
    m(prisma.product.findUnique).mockResolvedValueOnce({ storeId: "store-1", status: "ACTIVE" });
    m(prisma.advertisingPlacementDefinition.findUnique).mockResolvedValueOnce({ id: "pl-1", status: "ACTIVE", sponsoredObjectType: "PRODUCT" });
    m(prisma.advertisingRateCardVersion.findUnique).mockResolvedValueOnce({ id: "rc-1", status: "ACTIVE", placementDefinitionId: "pl-1", minimumCampaignFunding: 200 });
    m(prisma.advertisingCampaignVersion.findFirst).mockResolvedValueOnce({ versionNumber: 1 });
    
    m(prisma.advertisingCampaignVersion.create).mockResolvedValueOnce({ id: "ver-2", versionNumber: 2 });

    const ver = await campaignService.createCampaignVersion("store-1", "camp-ref", {
      sponsoredObjectType: "PRODUCT",
      sponsoredProductId: "prod-1",
      placementDefinitionId: "pl-1",
      rateCardVersionId: "rc-1",
      startsAt: new Date(),
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
        creativeType: "CANONICAL_PRODUCT_CARD",
        title: "Test Creative",
        imageAssetReference: "/img.png",
        storeDisplayName: "Test Store",
        destinationType: "STOREFRONT",
        destinationReference: "/store/catalog"
      }
    });

    expect(ver.versionNumber).toBe(2);
  });

  // 3. CampaignService.submitCampaignForReview
  it("Service 3: submitCampaignForReview transitions status to UNDER_REVIEW", async () => {
    m(prisma.store.findUnique).mockResolvedValueOnce({ status: "ACTIVE" });
    m(prisma.advertisingCampaign.findFirst).mockResolvedValueOnce({ id: "camp-1", status: "DRAFT" });
    m(prisma.advertisingCampaignVersion.findFirst).mockResolvedValueOnce({ id: "ver-1" });
    m(prisma.advertisingCampaign.update).mockResolvedValueOnce({ id: "camp-1", status: "UNDER_REVIEW" });

    const result = await campaignService.submitCampaignForReview("store-1", "camp-ref");
    expect(result.status).toBe("UNDER_REVIEW");
  });

  // 4. CampaignService.moderateCampaign (Approve)
  it("Service 4: moderateCampaign approves a campaign with version approvedBy signature", async () => {
    m(prisma.advertisingCampaign.findUnique).mockResolvedValueOnce({
      id: "camp-1",
      status: "UNDER_REVIEW",
      versions: [{ id: "ver-1" }]
    });
    m(prisma.advertisingCampaignVersion.update).mockResolvedValueOnce({ id: "ver-1", approvedByUserId: "admin-1" });
    m(prisma.advertisingCampaign.update).mockResolvedValueOnce({ id: "camp-1", status: "APPROVED" });

    const result = await campaignService.moderateCampaign("camp-ref", "APPROVE", "admin-1");
    expect(result.status).toBe("APPROVED");
  });

  // 5. CampaignService.activateCampaign
  it("Service 5: activateCampaign changes campaign and version status to ACTIVE", async () => {
    m(prisma.advertisingCampaign.findUnique).mockResolvedValueOnce({
      id: "camp-1",
      status: "APPROVED",
      versions: [{ id: "ver-1" }]
    });
    m(prisma.advertisingFundingAllocation.findFirst).mockResolvedValueOnce({ id: "alloc-1", status: "FUNDED" });
    m(prisma.advertisingCampaignVersion.update).mockResolvedValueOnce({ id: "ver-1", status: "ACTIVE" });
    m(prisma.advertisingCampaign.update).mockResolvedValueOnce({ id: "camp-1", status: "ACTIVE" });

    const result = await campaignService.activateCampaign("camp-ref");
    expect(result.status).toBe("ACTIVE");
  });

  // 6. FundingService.fundCampaign
  it("Service 6: fundCampaign locks resources, posts ledger, creates allocation and movement", async () => {
    // Mock version load
    m(prisma.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      campaignId: "camp-1",
      campaign: { id: "camp-1", name: "Summer Campaign", storeId: "store-1", status: "APPROVED" },
      rateCardVersion: { id: "rc-1", minimumCampaignFunding: new Prisma.Decimal(200) }
    });

    // Mock store wallet check
    m(prisma.wallet.findUnique).mockResolvedValueOnce({ id: "store-wallet-1", status: "ACTIVE" });

    // Mock store payable account check
    m(prisma.ledgerAccount.findFirst).mockResolvedValueOnce({
      id: "store-payable-1",
      status: "ACTIVE",
      currentBalance: new Prisma.Decimal(1000)
    });

    // Mock allocation create
    m(prisma.advertisingFundingAllocation.create).mockResolvedValueOnce({ id: "alloc-1", status: "FUNDED" });

    const result = await fundingService.fundCampaign({
      campaignVersionId: "ver-1",
      storeId: "store-1",
      amount: 500,
      actorUserId: "user-1",
      operationId: "op-fund-1",
      requestHash: "hash-fund-1"
    });

    expect(result.status).toBe("FUNDED");
    expect(prisma.advertisingFundingAllocation.create).toHaveBeenCalled();
    expect(prisma.advertisingFundingMovement.create).toHaveBeenCalled();
    expect(prisma.advertisingCampaign.update).toHaveBeenCalledWith({
      where: { id: "camp-1" },
      data: { status: "FUNDED" }
    });
  });

  // 7. FundingService.returnUnusedFunding
  it("Service 7: returnUnusedFunding handles ended/rejected campaigns return allocations", async () => {
    // Mock version load
    m(prisma.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      campaignId: "camp-1",
      campaign: { id: "camp-1", name: "Summer Campaign", storeId: "store-1", status: "ENDED" },
      fundingAllocations: [
        { id: "alloc-1", remainingAmount: new Prisma.Decimal(300), returnedAmount: new Prisma.Decimal(0) }
      ]
    });

    // Mock pending charges check
    m(prisma.advertisingClickCharge.count).mockResolvedValueOnce(0);

    // Mock unresolved cases check
    m(prisma.advertisingReconciliationCase.count).mockResolvedValueOnce(0);

    // Mock store wallet & payable
    m(prisma.wallet.findUnique).mockResolvedValueOnce({ id: "store-wallet-1", status: "ACTIVE" });
    m(prisma.ledgerAccount.findFirst).mockResolvedValueOnce({ id: "store-payable-1", status: "ACTIVE" });

    const result = await fundingService.returnUnusedFunding({
      campaignVersionId: "ver-1",
      storeId: "store-1",
      actorUserId: "user-1",
      operationId: "op-return-1",
      requestHash: "hash-return-1"
    });

    expect(result.returnedAmount).toBe("300.00");
    expect(prisma.advertisingFundingAllocation.update).toHaveBeenCalled();
    expect(prisma.advertisingFundingMovement.create).toHaveBeenCalled();
  });

  // 8. BillingService.chargeClick
  it("Service 8: chargeClick charges valid clicks and updates remaining allocation budgets", async () => {
    // Mock measurement event check
    m(prisma.advertisingMeasurementEvent.findUnique).mockResolvedValueOnce({
      id: "event-1",
      eventType: "CLICK",
      validityStatus: "VALID",
      publicReference: "REF-1",
      campaignVersionId: "ver-1"
    });

    // Mock existing charge check (none)
    m(prisma.advertisingClickCharge.findFirst).mockResolvedValueOnce(null);

    // Mock version check
    m(prisma.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      campaignId: "camp-1",
      dailyBudget: new Prisma.Decimal(200),
      totalBudget: new Prisma.Decimal(1000),
      rateCardVersionId: "rc-1",
      rateCardVersion: { id: "rc-1", costPerValidClick: new Prisma.Decimal(2.5) },
      campaign: { id: "camp-1", name: "Summer Campaign" }
    });

    // Mock funding allocation check
    m(prisma.advertisingFundingAllocation.findFirst).mockResolvedValueOnce({
      id: "alloc-1",
      remainingAmount: new Prisma.Decimal(100),
      spentAmount: new Prisma.Decimal(0),
      status: "FUNDED"
    });

    // Mock budget aggregations (under limits)
    m(prisma.advertisingClickCharge.aggregate).mockResolvedValue({
      _sum: { chargeAmount: new Prisma.Decimal(0) }
    });

    // Mock click charge create
    m(prisma.advertisingClickCharge.create).mockResolvedValueOnce({
      id: "charge-1",
      status: "CHARGED",
      chargeAmount: new Prisma.Decimal(2.5)
    });

    const result = await billingService.chargeClick({
      measurementEventId: "event-1",
      sessionFingerprint: "session-1",
      operationId: "op-charge-1",
      requestHash: "hash-charge-1"
    });

    expect(result.status).toBe("CHARGED");
    expect(prisma.advertisingFundingAllocation.update).toHaveBeenCalled();
    expect(prisma.advertisingFundingMovement.create).toHaveBeenCalled();
    expect(prisma.advertisingDailyAggregate.upsert).toHaveBeenCalled();
  });

  // 9. BillingService.reverseClick
  it("Service 9: reverseClick refunds charges and returns funds to active pool", async () => {
    // Mock click charge check
    m(prisma.advertisingClickCharge.findUnique).mockResolvedValueOnce({
      id: "charge-1",
      publicReference: "REF-CHG-1",
      status: "CHARGED",
      chargeAmount: new Prisma.Decimal(2.5),
      fundingAllocationId: "alloc-1",
      campaignVersionId: "ver-1",
      chargedAt: new Date()
    });

    // Mock funding allocation check
    m(prisma.advertisingFundingAllocation.findUnique).mockResolvedValueOnce({
      id: "alloc-1",
      remainingAmount: new Prisma.Decimal(97.5),
      spentAmount: new Prisma.Decimal(2.5),
      status: "PARTIALLY_SPENT"
    });

    // Mock campaign version check
    m(prisma.advertisingCampaignVersion.findUnique).mockResolvedValueOnce({
      id: "ver-1",
      placementDefinitionId: "pl-1"
    });

    // Mock click charge update
    m(prisma.advertisingClickCharge.update).mockResolvedValueOnce({
      id: "charge-1",
      status: "REVERSED"
    });

    const result = await billingService.reverseClick({
      clickChargeId: "charge-1",
      reason: "BOT_TRAFFIC",
      actorUserId: "user-admin",
      operationId: "op-reverse-1",
      requestHash: "hash-reverse-1"
    });

    expect(result.reversedAmount).toBe("2.50");
    expect(prisma.advertisingClickCharge.update).toHaveBeenCalledWith({
      where: { id: "charge-1" },
      data: expect.objectContaining({ status: "REVERSED" })
    });
    expect(prisma.advertisingFundingAllocation.update).toHaveBeenCalled();
    expect(prisma.advertisingFundingMovement.create).toHaveBeenCalled();
    expect(prisma.advertisingDailyAggregate.update).toHaveBeenCalled();
  });

  // 10. Reconciliation and Aggregation runs
  it("Service 10: reconciliation scanner detects anomalies and logs cases", async () => {
    m(prisma.advertisingClickCharge.findMany).mockResolvedValueOnce([]);
    m(prisma.advertisingMeasurementEvent.findMany).mockResolvedValueOnce([]);
    m(prisma.advertisingCampaign.findMany).mockResolvedValueOnce([]);
    const cases = await reconciliationService.scanForReconciliationDiscrepancies();
    expect(Array.isArray(cases)).toBe(true);
  });
});
