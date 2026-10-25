import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deliveryServiceDefinition: { count: vi.fn(), findFirst: vi.fn() },
  deliveryRegion: { findMany: vi.fn() },
  parcelProfile: { findMany: vi.fn() },
  commissionPlan: { count: vi.fn() },
  subscriptionPlanVersion: { count: vi.fn() },
  promoterProgramVersion: { count: vi.fn() },
  advertisingRateCardVersion: { count: vi.fn() },
  paymentMethodPolicy: { findMany: vi.fn() },
  systemSetting: { findUnique: vi.fn() },
  operationalProcessorRun: { findFirst: vi.fn() },
  notificationEventRoute: { findMany: vi.fn() },
  notificationEventRouteVersion: { findMany: vi.fn() },
  notificationTemplateVersion: { findMany: vi.fn() },
  notificationRecipientPolicyVersion: { findMany: vi.fn() },
  productionAcceptanceRecord: { findMany: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/health/checks", () => ({
  checkReadiness: vi.fn().mockResolvedValue({ database: "reachable", redis: { configured: false, connected: false } }),
}));
vi.mock("@/lib/security/integration-registry", () => ({
  getIntegrationRegistry: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/payments/providers/paystack/paystack-config", () => ({
  resolvePaystackConfiguration: vi.fn().mockReturnValue({ state: { configured: false, active: false } }),
}));
vi.mock("@/lib/commercial/configuration.service", () => ({
  getActiveParcelProfiles: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/marketplace-checkout/delivery-policy-configuration", () => ({
  listDeliveryMatrices: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/client-platform/driver-cash.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-platform/driver-cash.service")>()),
  readBankInstructions: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/production-readiness/evidence", () => ({
  acceptanceKeys: ["payment_integration_acceptance"],
  listAcceptanceEvidence: vi.fn().mockResolvedValue([]),
  evidenceIsCurrent: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/marketplace-checkout/courier-tariff-policy", () => ({ marketplaceCourierTariffPolicy: vi.fn().mockResolvedValue(null) }));
import { marketplaceCourierTariffPolicy } from "@/lib/marketplace-checkout/courier-tariff-policy";
import { getProductionReadiness } from "@/lib/production-readiness/service";

describe("Commercial Program Readiness Scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(marketplaceCourierTariffPolicy).mockResolvedValue(null);
    db.deliveryServiceDefinition.count.mockResolvedValue(1);
    db.deliveryRegion.findMany.mockResolvedValue([]);
    db.parcelProfile.findMany.mockResolvedValue([]);
    db.commissionPlan.count.mockResolvedValue(1);
    db.subscriptionPlanVersion.count.mockResolvedValue(0);
    db.promoterProgramVersion.count.mockResolvedValue(0);
    db.advertisingRateCardVersion.count.mockResolvedValue(0);
    db.paymentMethodPolicy.findMany.mockResolvedValue([]);
    db.systemSetting.findUnique.mockResolvedValue(null);
    db.operationalProcessorRun.findFirst.mockResolvedValue(null);
    db.notificationEventRoute.findMany.mockResolvedValue([]);
    db.notificationEventRouteVersion.findMany.mockResolvedValue([]);
    db.notificationTemplateVersion.findMany.mockResolvedValue([]);
    db.notificationRecipientPolicyVersion.findMany.mockResolvedValue([]);
    db.productionAcceptanceRecord.findMany.mockResolvedValue([]);
  });

  it("does not label missing evidence as belonging to the deployed release", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "a".repeat(40));
    try {
      const entry = (await getProductionReadiness()).capabilities.find(c => c.key === "payment_integration_acceptance");
      expect(entry).toMatchObject({ status: "BLOCKED_LIVE_ACCEPTANCE", evidence: { evidenceStatus: "MISSING", currentRelease: false } });
    } finally { vi.unstubAllEnvs(); }
  });

  it("reports DISABLED_BY_POLICY when excluded commercial program count is 0", async () => {
    const report = await getProductionReadiness();

    const sub = report.capabilities.find((c) => c.key === "store_subscription_configuration");
    expect(sub).toBeDefined();
    expect(sub?.status).toBe("DISABLED_BY_POLICY");
    expect(sub?.reasonCode).toBe("COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY");

    const prom = report.capabilities.find((c) => c.key === "promoter_commercial_configuration");
    expect(prom).toBeDefined();
    expect(prom?.status).toBe("DISABLED_BY_POLICY");
    expect(prom?.reasonCode).toBe("COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY");

    const adv = report.capabilities.find((c) => c.key === "advertising_package_configuration");
    expect(adv).toBeDefined();
    expect(adv?.status).toBe("DISABLED_BY_POLICY");
    expect(adv?.reasonCode).toBe("COMMERCIAL_PROGRAM_INACTIVE_BY_POLICY");
  });

  it("reports BLOCKED_CONFIGURATION with COMMERCIAL_SCOPE_CONFLICT when an excluded program has active versions", async () => {
    db.subscriptionPlanVersion.count.mockResolvedValue(2);
    db.promoterProgramVersion.count.mockResolvedValue(1);
    db.advertisingRateCardVersion.count.mockResolvedValue(3);

    const report = await getProductionReadiness();

    const sub = report.capabilities.find((c) => c.key === "store_subscription_configuration");
    expect(sub?.status).toBe("BLOCKED_CONFIGURATION");
    expect(sub?.reasonCode).toBe("COMMERCIAL_SCOPE_CONFLICT");

    const prom = report.capabilities.find((c) => c.key === "promoter_commercial_configuration");
    expect(prom?.status).toBe("BLOCKED_CONFIGURATION");
    expect(prom?.reasonCode).toBe("COMMERCIAL_SCOPE_CONFLICT");

    const adv = report.capabilities.find((c) => c.key === "advertising_package_configuration");
    expect(adv?.status).toBe("BLOCKED_CONFIGURATION");
    expect(adv?.reasonCode).toBe("COMMERCIAL_SCOPE_CONFLICT");
  });
});

describe("100% personal parcel COD production readiness", () => {
  const date = new Date("2026-10-25T00:00:00.000Z");
  const bank = {
    bankName: "Verified test bank", accountName: "KT Couriers Pty", accountNumber: "123456789",
    branchCode: "123456", referenceHint: "Use delivery reference", expectedVersion: 1, handoverEnabled: false,
  };
  const approval = { approvedByUserId: "finance-reviewer", approvedAt: "2026-10-20T12:00:00.000Z", remittanceApproved: true, remittanceUpdatedAt: date.toISOString(), settlementTiming: "Daily" };
  const valid = { id: "personal-cod", mode: "FULL_COD", storeId: null, deliveryServiceId: "CLIENT_STANDARD",
    orderType: "PARCEL_DOCUMENT", provinceScope: ["Gauteng"], regionId: null,
    maximumCodAmount: { toString: () => "1000.00" }, depositPercent: null, depositAmount: null,
    createdByUserId: "policy-author", policyEvidence: approval };
  beforeEach(() => {
    db.deliveryServiceDefinition.count.mockResolvedValue(1);
    db.deliveryRegion.findMany.mockResolvedValue([]);
    db.parcelProfile.findMany.mockResolvedValue([]);
    db.commissionPlan.count.mockResolvedValue(1);
    db.subscriptionPlanVersion.count.mockResolvedValue(0);
    db.promoterProgramVersion.count.mockResolvedValue(0);
    db.advertisingRateCardVersion.count.mockResolvedValue(0);
    db.systemSetting.findUnique.mockResolvedValue({ value: bank, updatedAt: date });
    db.operationalProcessorRun.findFirst.mockResolvedValue(null);
    db.notificationEventRoute.findMany.mockResolvedValue([]);
    db.notificationEventRouteVersion.findMany.mockResolvedValue([]);
    db.notificationTemplateVersion.findMany.mockResolvedValue([]);
    db.notificationRecipientPolicyVersion.findMany.mockResolvedValue([]);
    db.productionAcceptanceRecord.findMany.mockResolvedValue([]);
  });
  it("recognizes independently approved 100% COD for personal parcels", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([valid]);
    const entry = (await getProductionReadiness()).capabilities.find(c => c.key === "cod_policy");
    expect(entry).toMatchObject({ status: "READY", reasonCode: "COD_SCOPED_APPROVAL_CURRENT", evidence: { scopedPolicyCount: 1 } });
  });
  it("does not mistake a legacy 50/50 business policy for the 100% personal parcel launch feature", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([{ ...valid, mode: "DEPOSIT_PLUS_COD", storeId: "store-1", depositPercent: { toString: () => "0.5" } }]);
    const entry = (await getProductionReadiness()).capabilities.find(c => c.key === "cod_policy");
    expect(entry).toMatchObject({ status: "BLOCKED_EXTERNAL_INPUT", reasonCode: "COD_APPROVED_SCOPE_MISSING" });
  });
  it("does not authorize COD after the banking instructions have changed", async () => {
    db.paymentMethodPolicy.findMany.mockResolvedValue([valid]);
    db.systemSetting.findUnique.mockResolvedValue({ value: bank, updatedAt: new Date("2026-10-25T10:00:00Z") });
    const entry = (await getProductionReadiness()).capabilities.find(c => c.key === "cod_policy");
    expect(entry).toMatchObject({ status: "BLOCKED_EXTERNAL_INPUT" });
  });
});

describe("Marketplace delivery pricing readiness", () => {
  it("accepts the configured courier pricing model without requiring a separate matrix", async () => {
    vi.mocked(marketplaceCourierTariffPolicy).mockResolvedValue({ enabled: true, defaultServiceKey: "CLIENT_ECONOMY", approvalReference: "reviewed-owner-approval" });
    db.deliveryServiceDefinition.findFirst.mockResolvedValue({ id: "active-service" });
    const result = (await getProductionReadiness()).capabilities.find(item => item.key === "marketplace_delivery_fee_matrix");
    expect(result).toMatchObject({ status: "READY", reasonCode: "APPROVED_MARKETPLACE_COURIER_TARIFFS" });
    expect(db.deliveryServiceDefinition.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stableKey: "CLIENT_ECONOMY", status: "ACTIVE" }) }));
  });
  it("blocks a configured courier pricing model whose service is no longer active", async () => {
    vi.mocked(marketplaceCourierTariffPolicy).mockResolvedValue({ enabled: true, defaultServiceKey: "CLIENT_ECONOMY", approvalReference: "reviewed-owner-approval" });
    db.deliveryServiceDefinition.findFirst.mockResolvedValue(null);
    const result = (await getProductionReadiness()).capabilities.find(item => item.key === "marketplace_delivery_fee_matrix");
    expect(result).toMatchObject({ status: "BLOCKED_CONFIGURATION", reasonCode: "MARKETPLACE_COURIER_SERVICE_UNAVAILABLE" });
  });
});
