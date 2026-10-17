import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deliveryServiceDefinition: { count: vi.fn() },
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
vi.mock("@/lib/client-platform/driver-cash.service", () => ({
  readBankInstructions: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/production-readiness/evidence", () => ({
  acceptanceKeys: [],
  listAcceptanceEvidence: vi.fn().mockResolvedValue([]),
  evidenceIsCurrent: vi.fn().mockReturnValue(false),
}));

import { getProductionReadiness } from "@/lib/production-readiness/service";

describe("Commercial Program Readiness Scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
