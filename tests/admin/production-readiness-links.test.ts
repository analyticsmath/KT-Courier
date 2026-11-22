import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  store: { count: vi.fn() },
  driverProfile: { count: vi.fn() },
  storeOrderOperationalPolicy: { findFirst: vi.fn() },
  privacyRetentionPolicyVersion: { count: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/health/checks", () => ({
  checkReadiness: vi.fn().mockResolvedValue({ database: "reachable", redis: { configured: false, connected: false } }),
}));
vi.mock("@/lib/security/integration-registry", () => ({
  getIntegrationRegistry: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/payments/providers/paystack/paystack-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/providers/paystack/paystack-config")>();
  return {
    ...actual,
    resolvePaystackConfiguration: vi.fn().mockReturnValue({ state: { configured: false, active: false, environment: "not-configured" } }),
  };
});
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
vi.mock("@/lib/marketplace-checkout/courier-tariff-policy", () => ({
  marketplaceCourierTariffPolicy: vi.fn().mockResolvedValue(null),
}));

import { ProductionReadinessBoard } from "@/components/admin/ProductionReadinessBoard";
import { getProductionReadiness } from "@/lib/production-readiness/service";

function adminPageExists(href: string): boolean {
  const segments = href.replace(/^\//, "").split("/");
  return existsSync(path.join(process.cwd(), "app", "(admin)", ...segments, "page.tsx"));
}

describe("production readiness repair and diagnostic links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.deliveryServiceDefinition.count.mockResolvedValue(0);
    db.deliveryServiceDefinition.findFirst.mockResolvedValue(null);
    db.deliveryRegion.findMany.mockResolvedValue([]);
    db.parcelProfile.findMany.mockResolvedValue([]);
    db.commissionPlan.count.mockResolvedValue(0);
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
    db.store.count.mockResolvedValue(0);
    db.driverProfile.count.mockResolvedValue(0);
    db.storeOrderOperationalPolicy.findFirst.mockResolvedValue(null);
    db.privacyRetentionPolicyVersion.count.mockResolvedValue(0);
  });

  it("emits /admin/payment-providers for Provider diagnostics in both readiness data and rendered board, and verifies every link exists", async () => {
    const readiness = await getProductionReadiness();
    const providerRepairLink = readiness.entityConfigurationStatus.repairLinks.find(
      (link) => link.label === "Provider diagnostics",
    );

    expect(providerRepairLink).toEqual({
      label: "Provider diagnostics",
      href: "/admin/payment-providers",
    });
    expect(
      readiness.entityConfigurationStatus.repairLinks.some((link) => link.href === "/admin/integrations"),
    ).toBe(false);

    for (const link of readiness.entityConfigurationStatus.repairLinks) {
      expect(adminPageExists(link.href), `Missing page for repair link ${link.href}`).toBe(true);
    }

    const html = renderToStaticMarkup(
      createElement(ProductionReadinessBoard, {
        capabilities: readiness.capabilities,
        capabilityMatrix: readiness.capabilityMatrix,
        envSchema: readiness.envSchema,
        commerceActivation: readiness.commerceActivation,
        entityConfigurationStatus: readiness.entityConfigurationStatus,
      }),
    );

    expect(html).toContain('href="/admin/payment-providers"');
    expect(html).not.toContain("/admin/integrations");
  });
});
