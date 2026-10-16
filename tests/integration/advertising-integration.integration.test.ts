import { describe, expect, it } from "vitest";
import { AdvertisingFundingError } from "@/lib/advertising/funding.service";
import { assertAdvertisingProductionReady } from "@/lib/advertising/production-lock";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";

describe("Phase 24: Advertising Live & Managed Marketing Domain Integration Tests", () => {
  it("Integration 1: Advertising Funding Error instantiates with correct error codes", () => {
    const error = new AdvertisingFundingError("INSUFFICIENT_FUNDS", "Store wallet balance is insufficient.");
    expect(error.name).toBe("AdvertisingFundingError");
    expect(error.code).toBe("INSUFFICIENT_FUNDS");
    expect(error.message).toBe("Store wallet balance is insufficient.");
  });

  it("Integration 2: assertAdvertisingProductionReady throws fail-closed error when production lock is active", () => {
    expect(() => assertAdvertisingProductionReady("CAMPAIGN_FUNDING")).toThrowError(/validation is approved|inactive/i);
  });

  it("Integration 3: ManagedMarketingService validates channel code structure", async () => {
    const service = new ManagedMarketingService();
    await expect(
      service.createChannel({
        actorUserId: "admin-1",
        actorRole: "ADMIN",
        code: "invalid_lowercase",
        displayName: "Invalid Channel",
      })
    ).rejects.toThrow();
  });

  it("Integration 4: ManagedMarketingService enforces explicit execution mode capability", async () => {
    const service = new ManagedMarketingService();
    await expect(
      service.requireApprovedForExecution("REQ-NON-EXISTENT")
    ).rejects.toThrow();
  });

  it("Integration 5: ManagedMarketingService rejects unapproved request mutations", async () => {
    const service = new ManagedMarketingService();
    await expect(
      service.runManually(
        { actorUserId: "admin-1", actorRole: "ADMIN" },
        "REQ-DRAFT-REF",
        { operationId: "op-run-1", externalReference: "ext-123" }
      )
    ).rejects.toThrow();
  });

  it("Integration 6: Commercial pricing snapshot calculation asserts gross revenue balance", () => {
    const service = new ManagedMarketingService();
    const testRequest = {
      priceSnapshot: "1000.00",
      taxSnapshot: "0.15",
      currency: "ZAR",
    };
    const commercial = (service as any).deriveCommercialDto(testRequest);
    expect(commercial).not.toBeNull();
    expect(commercial.currency).toBe("ZAR");
    expect(Number(commercial.grossAmount)).toBeCloseTo(1150.0, 2);
    expect(Number(commercial.taxAmount)).toBeCloseTo(150.0, 2);
  });

  it("Integration 7: Provider configuration guards prevent unverified automation execution", () => {
    const service = new ManagedMarketingService();
    expect(() =>
      (service as any).assertExecutionCapability("AUTOMATED_PROVIDER", [
        { active: true, automatedProviderCapability: "MANUAL_AVAILABLE" },
      ])
    ).toThrowError(/Automated provider publishing requires an explicitly configured provider/i);
  });

  it("Integration 8: Placement target validation distinguishes on-platform from external placements", async () => {
    const service = new ManagedMarketingService();
    await expect(
      (service as any).resolvePlacementTarget({
        kind: "ON_PLATFORM",
        advertisingPlacementReference: null,
      })
    ).rejects.toThrowError(/Placement target is invalid/i);
  });

  it("Integration 9: Reject action requires actor and structured rejection reason", async () => {
    const service = new ManagedMarketingService();
    await expect(
      service.rejectRequest(
        { actorUserId: "", actorRole: "ADMIN" } as any,
        "REQ-TEST",
        "OP-1",
        ""
      )
    ).rejects.toThrow();
  });

  it("Integration 10: Performance recording rejects invalid metrics", async () => {
    const service = new ManagedMarketingService();
    await expect(
      service.recordPerformance(
        { actorUserId: "admin-1", actorRole: "ADMIN" },
        "REQ-TEST",
        {
          operationId: "op-perf-1",
          impressions: -5,
          clicks: 10,
          conversions: 0,
          periodStartsAt: new Date(),
          periodEndsAt: new Date(),
          externalReference: "ext-1",
        }
      )
    ).rejects.toThrow();
  });
});
