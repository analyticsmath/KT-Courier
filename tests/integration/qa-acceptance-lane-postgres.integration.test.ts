import { createHash, randomInt, randomUUID } from "node:crypto";
import { CompanyProfileVersionStatus, Prisma } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  DeliveryType,
  OrderSource,
  OrderStatus,
  UserRole,
  UserStatus,
} from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import {
  activateCompanyProfile,
} from "@/lib/services/company-profile.service";
import {
  enrollQaAcceptancePrincipal,
  revokeQaAcceptancePrincipal,
  startQaAcceptanceRun,
  updateQaAcceptanceRunLifecycle,
} from "@/lib/qa-acceptance/service";
import {
  resolveQaAcceptanceSessionContext,
  resolveQaVisibleStoreIdsForViewer,
} from "@/lib/qa-acceptance/access";
import { listEligibleDrivers } from "@/lib/services/driver-eligibility.service";
import { DEFAULT_STORE_OPERATING_HOURS } from "@/lib/qa-acceptance/operating-hours";
import { updateStoreProfile } from "@/lib/services/profiles.service";
import {
  getQaStorefrontProduct,
  getQaStorefrontStore,
  getStorefrontStore,
  listQaStorefrontStores,
  listStorefrontStores,
} from "@/lib/services/storefront-catalog.service";
import {
  activePublicStoreDocumentSql,
  activeQaStoreDocumentSql,
} from "@/lib/storefront/sql-store-publication";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { moderateCatalogOffer, moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import {
  CatalogMediaIntakeService,
  PrismaCatalogMediaRepository,
} from "@/lib/services/catalog-media-intake.service";
import {
  DeterministicCatalogMediaStorageAdapter,
} from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersions,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import {
  activateCommissionPlan,
  approveCommissionPlan,
  createCommissionPlan,
  submitCommissionPlan,
} from "@/lib/services/commission-plan.service";
import {
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  prepareStoreCheckoutCertificationFromPreflight,
} from "@/lib/admin/store-checkout-certification.service";
import {
  createLegalDocumentDraft,
  publishLegalDocumentVersion,
} from "@/lib/services/legal-documents.service";
import { resolveMarketplaceLegalEvidence } from "@/lib/marketplace-checkout/legal-evidence";
import {
  addCartLine,
  createOrResolveCart,
} from "@/lib/marketplace-checkout/cart-mutation.service";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import {
  beginMarketplaceReservation,
  createMarketplaceCheckout,
  prepareMarketplacePayment,
  updateMarketplaceCheckoutAddress,
  updateMarketplaceCheckoutContact,
} from "@/lib/marketplace-checkout/checkout.service";
import {
  executeMarketplaceCheckoutAcknowledgement,
  executeMarketplaceCheckoutReview,
  executeMarketplaceDeliveryQuotes,
} from "@/lib/marketplace-checkout/composition-root";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "@/lib/marketplace-checkout/settlement.service";
import {
  acceptMarketplaceStoreOrder,
  beginStoreOrderReview,
  confirmStoreOrderLineAvailability,
  createMarketplaceDeliveryBridge,
  generateStoreOrderPickupChallenge,
  initializeMarketplaceStoreOrderOperations,
  markStoreOrderReadyForHandoff,
  startStoreOrderPreparation,
  verifyStoreOrderPickupHandoff,
} from "@/lib/store-orders/store-order.service";
import { recoverPaystackAttemptViaVerify } from "@/lib/services/paystack-verify-recovery.service";
import {
  acceptDispatchAssignment,
  offerAssignment,
} from "@/lib/services/dispatch-assignment.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { adminManualDeliveryComplete } from "@/lib/services/delivery-execution.service";
import {
  downloadAuthorizedShipmentDocumentPdf,
  getOrderDocumentAvailability,
} from "@/lib/shipment-documents/service";
import {
  issueTrackingShareGrant,
  verifyAndResolveTrackingToken,
} from "@/lib/tracking/recipient-access.server";
import { produceDriverSettlement } from "@/lib/services/driver-settlement-producer.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { createWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";
import {
  actOnDeliveryMatrix,
  listDeliveryMatrices,
  saveDeliveryMatrix,
} from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";
import { createPublicQuote } from "@/lib/client-platform/delivery.service";
import { createOrder } from "@/lib/services/orders.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { getDriverAssignmentDetail } from "@/lib/services/driver-assignments.service";
import {
  getLatestSafeDriverLocationProjection,
  recordDriverLocationSample,
  recordQaSimulatedDriverLocation,
  requireVerifiedDeliveryLocationInTx,
} from "@/lib/services/driver-location-evidence.service";
import { recordDriverDeliveryResponsibility } from "@/lib/services/shipping-obligations.service";
import { generateAndSendDeliveryOtp, getTestIssuedDeliveryOtp } from "@/lib/services/delivery-otp.service";
import { completeDelivery } from "@/lib/services/delivery-execution.service";
import { trackingMapPoints } from "@/lib/maps/tracking-map-presentation";
import { installSystemPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { createDriver, uniqueTag } from "./phase7-5-fixtures";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async (addr: { city?: string | null }) => {
      if ((addr.city ?? "").toLowerCase().includes("sandton")) {
        return { latitude: -26.1076, longitude: 28.0567 };
      }
      return { latitude: -26.2041, longitude: 28.0473 };
    }),
    reverseGeocodeSouthAfricanProvince: vi.fn(async () => "Gauteng" as const),
  };
});

vi.mock("@/lib/maps/routes.service", () => ({
  calculateRoute: vi.fn(async () => ({
    ok: true as const,
    route: {
      distanceMeters: 6400,
      durationSeconds: 900,
      provider: "TEST_QA_ROUTE",
      routeSummary: "Kaventra Sandton -> Marshalltown",
    },
  })),
}));

const reqHash = (label: string) => createHash("sha256").update(label).digest("hex");

function toAuthUser(row: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
}): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "QA User",
    role: row.role,
    status: row.status,
  };
}

describe("GitHub Issue #40 — Isolated QA Acceptance Lane End-to-End (PostgreSQL)", { timeout: 120_000 }, () => {
  const tag = uniqueTag("qa40").replace(/[^a-z0-9]/gi, "").slice(0, 14).toLowerCase();
  const settingKeysToClean: string[] = [];
  const createdProfileIds: string[] = [];
  let previousActiveCompanyProfileIds: string[] = [];
  let createdRegionId: string | null = null;
  let createdServiceId: string | null = null;
  let createdPolicyId: string | null = null;
  let globalCourierPlanId: string | null = null;
  let kaventraCommissionPlanId: string | null = null;

  let admin1!: AuthenticatedUser;
  let admin2!: AuthenticatedUser;
  let qaCustomer!: AuthenticatedUser;
  let ordinaryCustomer!: AuthenticatedUser;
  let kaventraOwner!: AuthenticatedUser;
  let liveStoreOwner!: AuthenticatedUser;
  let qaDriver!: Awaited<ReturnType<typeof createDriver>>;
  let liveDriver!: Awaited<ReturnType<typeof createDriver>>;
  let qaStoreId!: string;
  let qaStoreSlug!: string;
  let qaOfferRef!: string;
  let qaVariantRef!: string;
  let liveOfferRef!: string;
  let liveVariantRef!: string;
  let qaRunId!: string;
  let qaCustomerPrincipalId!: string;
  let seedPublishedProductFn!: (
    targetStoreId: string,
    ownerId: string,
    skuPrefix: string,
  ) => Promise<{ offerRef: string; variantRef: string }>;

  const QA_TEST_SECRET = ["sk", "test", "qa40_isolated_secret_0123456789"].join("_");

  beforeEach(() => {
    vi.stubEnv("QA_ACCEPTANCE_LANE_ENABLED", "true");
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY", QA_TEST_SECRET);
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_PUBLIC_KEY", ["pk", "test", "qa40_isolated_public_0123456789"].join("_"));
    vi.stubEnv("PAYSTACK_SECRET_KEY", ["sk", "live", "qa40_must_never_be_called_000"].join("_"));
    vi.stubEnv("PAYSTACK_ACTIVE", "false");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.ktcouriers.com");
    vi.stubEnv("PAYMENT_APP_ORIGIN", "https://www.ktcouriers.com");
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (
      process.env.NODE_ENV === "production" ||
      process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
      url.pathname !== "/kt_launch_test" ||
      !["localhost", "127.0.0.1"].includes(url.hostname)
    ) {
      throw new Error("Disposable kt_launch_test PostgreSQL database is required.");
    }

    await installSystemPermissionDefaults(prisma);

    const existingActive = await prisma.companyProfileVersion.findMany({
      where: { status: CompanyProfileVersionStatus.ACTIVE },
      select: { id: true },
    });
    previousActiveCompanyProfileIds = existingActive.map((p) => p.id);

    const [a1, a2, qCust, oCust, kOwn, lOwn] = await Promise.all([
      prisma.user.create({
        data: { email: `${tag}-adm1@example.test`, name: "QA Admin 1", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { email: `${tag}-adm2@example.test`, name: "QA Admin 2", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { email: `${tag}-qacust@example.test`, name: "QA Demo Customer", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820001111" },
      }),
      prisma.user.create({
        data: { email: `${tag}-ordcust@example.test`, name: "Ordinary Shopper", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820002222" },
      }),
      prisma.user.create({
        data: { email: `${tag}-kaventra@example.test`, name: "Kaventra Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820003333" },
      }),
      prisma.user.create({
        data: { email: `${tag}-livestore@example.test`, name: "Live Store Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820004444" },
      }),
    ]);

    admin1 = toAuthUser(a1);
    admin2 = toAuthUser(a2);
    qaCustomer = toAuthUser(qCust);
    ordinaryCustomer = toAuthUser(oCust);
    kaventraOwner = toAuthUser(kOwn);
    liveStoreOwner = toAuthUser(lOwn);

    const prof = await activateCompanyProfile(admin1.id, {
      legalName: "KT Couriers (Pty) Ltd",
      tradingName: "KT Couriers",
      registrationNumber: "2024/123456/07",
      supportEmail: "dispatch@ktcouriers.com",
      website: "https://www.ktcouriers.com",
    });
    createdProfileIds.push(prof.id);

    await prisma.$transaction(async (tx) => {
      const pw = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" }, tx);
      await ensureLedgerAccount({ walletId: pw.id, code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR" }, tx);
    });

    const region = await prisma.deliveryRegion.create({
      data: {
        name: `QA Sandton ${tag}`,
        slug: `qa-sandton-${tag}`,
        city: "Johannesburg",
        province: "Gauteng",
        coverageMode: "RADIUS",
        centerLat: "-26.1076000",
        centerLng: "28.0567000",
        coverageRadiusKm: "60.00",
        maxDistanceKm: "80.00",
        displayOrder: -50,
        active: true,
        pricingEnabled: true,
      },
    });
    createdRegionId = region.id;

    qaDriver = await createDriver(`${tag}-qadrv`, region.id, 3);
    liveDriver = await createDriver(`${tag}-lvdrv`, region.id, 3);
    await prisma.driverProfile.updateMany({
      where: { id: { in: [qaDriver.profile.id, liveDriver.profile.id] } },
      data: { onboardingStatus: "APPROVED" },
    });

    const latestStd = await prisma.deliveryServiceDefinition.findFirst({
      where: { stableKey: "CLIENT_STANDARD" },
      orderBy: { versionNumber: "desc" },
    });
    const svc = await prisma.deliveryServiceDefinition.create({
      data: {
        stableKey: "CLIENT_STANDARD",
        versionNumber: (latestStd?.versionNumber ?? 0) + 1,
        displayName: "Standard",
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: admin1.id,
        pricingPolicy: {
          stableKey: "CLIENT_STANDARD",
          displayName: "Standard",
          active: true,
          turnaround: "1-2 business days",
          provinces: ["Gauteng"],
          regionIds: [region.id],
          tariffs: {
            SMALL: { baseFee: "110.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
            MEDIUM: { baseFee: "160.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
            LARGE: { baseFee: "220.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
          },
          expectedVersion: latestStd?.versionNumber ?? 0,
          reason: "QA Issue #40 test service definition",
        },
        coveragePolicy: { provinces: ["Gauteng"], regionIds: [region.id] },
        slaMetadata: { turnaround: "1-2 business days" },
      },
    });
    createdServiceId = svc.id;

    const existingInvalid = await prisma.deliveryServiceDefinition.findMany({
      where: { stableKey: { startsWith: "CLIENT_" }, status: "ACTIVE", id: { not: svc.id } },
      select: { id: true, pricingPolicy: true },
    });
    const badIds = existingInvalid.filter((r) => !DeliveryConfigurationSchema.safeParse(r.pricingPolicy).success).map((r) => r.id);
    if (badIds.length) {
      await prisma.deliveryServiceDefinition.updateMany({ where: { id: { in: badIds } }, data: { status: "RETIRED" } });
    }

    for (const spec of [
      { stableKey: "SMALL", displayName: "Small Parcel", l: 30, w: 20, h: 10, kg: 5 },
      { stableKey: "MEDIUM", displayName: "Medium Parcel", l: 45, w: 35, h: 25, kg: 15 },
      { stableKey: "LARGE", displayName: "Large Parcel", l: 70, w: 50, h: 40, kg: 30 },
    ] as const) {
      await prisma.parcelProfileVersion.upsert({
        where: { stableKey_versionNumber: { stableKey: spec.stableKey, versionNumber: 1 } },
        create: {
          stableKey: spec.stableKey,
          displayName: spec.displayName,
          versionNumber: 1,
          status: "ACTIVE",
          lengthCm: spec.l,
          widthCm: spec.w,
          heightCm: spec.h,
          maximumWeightKg: spec.kg,
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: admin1.id,
        },
        update: { status: "ACTIVE" },
      });
    }

    const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({ where: { status: "ACTIVE" } });
    if (!existingPolicy) {
      const pol = await prisma.storeOrderOperationalPolicy.create({
        data: {
          publicReference: `SOP-QA-${tag}`,
          name: `qa-policy-${tag}`,
          versionNumber: 1,
          status: "ACTIVE",
          acceptanceWindowSeconds: 900,
          customerDecisionWindowSeconds: 900,
          maximumPrepMinutes: 60,
          maximumPrepExtensionMinutes: 30,
          maximumIssueCount: 3,
          maximumSubstitutionProposalsPerLine: 2,
          effectiveFrom: new Date(Date.now() - 60_000),
          approvedByUserId: admin1.id,
          activatedAt: new Date(),
        },
      });
      createdPolicyId = pol.id;
    }

    const existingLegal = await resolveMarketplaceLegalEvidence().catch(() => null);
    if (!existingLegal) {
      for (const documentType of ["TERMS_OF_SERVICE", "PRIVACY_NOTICE", "REFUND_POLICY"] as const) {
        const doc = await createLegalDocumentDraft({
          actorUserId: admin1.id,
          documentType,
          jurisdiction: "ZA",
          version: `${tag}-${documentType}`,
          content: `QA acceptance test ${documentType}`,
        });
        await publishLegalDocumentVersion({
          actorUserId: admin1.id,
          publicReference: String(doc.publicReference),
          operationId: `${tag}-${documentType}-pub`,
          effectiveAt: new Date(Date.now() - 60_000),
        });
      }
    }

    const existingGlobalCourierPlan = await prisma.commissionPlan.findFirst({
      where: { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", status: "ACTIVE" },
    });
    if (!existingGlobalCourierPlan) {
      const gPlan = await createCommissionPlan({
        subjectType: "COURIER_ORDER",
        scopeKey: "GLOBAL:COURIER_ORDER",
        basisType: "ORDER_TOTAL",
        effectiveFrom: new Date(Date.now() - 3600_000).toISOString(),
        calculationVersion: `qa-courier-plan-${tag}`,
        rules: [{
          ruleCode: "QA_COURIER_FEE",
          allocationType: "PLATFORM_COMMISSION_REVENUE",
          beneficiaryType: "PLATFORM",
          calculationMethod: "PERCENTAGE_BPS",
          rateBasisPoints: 1000,
          priority: 1,
        }],
        actorUserId: admin1.id,
        operationId: randomUUID(),
      });
      await submitCommissionPlan(gPlan.id, admin1.id, randomUUID());
      await approveCommissionPlan(gPlan.id, admin2.id, randomUUID());
      await activateCommissionPlan(gPlan.id, admin2.id, randomUUID());
      globalCourierPlanId = gPlan.id;
    }

    const existingMatrices = await listDeliveryMatrices();
    const now = new Date();
    const hasActiveMatrix = existingMatrices.some(
      (v) =>
        v.status === "ACTIVE" &&
        v.approvedAt &&
        v.approvedByUserId &&
        v.approvedByUserId !== v.createdByUserId &&
        new Date(v.effectiveFrom) <= now &&
        (!v.effectiveTo || new Date(v.effectiveTo) > now),
    );
    if (!hasActiveMatrix) {
      const latestMatrixVer = Math.max(0, ...existingMatrices.map((v) => v.version));
      const savedMatrix = await saveDeliveryMatrix(admin1.id, {
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        effectiveTo: null,
        expectedVersion: latestMatrixVer,
        reason: "QA acceptance marketplace delivery matrix fixture",
        rules: [
          {
            key: `QA_GAUTENG_${tag.toUpperCase()}`,
            sizeClass: "ANY",
            minDistanceKm: 0,
            maxDistanceKm: 500,
            province: "Gauteng",
            regionId: null,
            storeId: null,
            fee: "45.00",
            highRiskSurcharge: "15.00",
            minimumFee: "25.00",
            maximumFee: "250.00",
          },
        ],
      });
      const matrixKey = `production_marketplace_delivery_matrix_v${savedMatrix.version}`;
      settingKeysToClean.push(matrixKey);
      const m1 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: matrixKey } });
      await actOnDeliveryMatrix(admin2.id, {
        version: savedMatrix.version,
        expectedUpdatedAt: m1.updatedAt.toISOString(),
        action: "APPROVE",
        reason: "Independent approval for QA delivery matrix",
      });
      const m2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: matrixKey } });
      await actOnDeliveryMatrix(admin2.id, {
        version: savedMatrix.version,
        expectedUpdatedAt: m2.updatedAt.toISOString(),
        action: "ACTIVATE",
        reason: "Activate QA marketplace delivery matrix",
      });
    }

    // Create Kaventra Tech Supply store + Live control store
    qaStoreSlug = `kaventra-tech-supply-${tag}`;
    const qaStore = await prisma.store.create({
      data: {
        ownerUserId: kaventraOwner.id,
        name: "Kaventra Tech Supply",
        slug: qaStoreSlug,
        status: "PENDING",
        contactEmail: kaventraOwner.email,
        contactPhone: "+27820003333",
      },
    });
    qaStoreId = qaStore.id;

    const qaPickup = await prisma.address.create({
      data: {
        storeId: qaStore.id,
        type: "PICKUP",
        isDefault: true,
        line1: "22 Sandton Drive",
        line2: "Sandhurst",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        latitude: "-26.1076000",
        longitude: "28.0567000",
        placeId: "place_kaventra_sandton",
      },
    });
    await prisma.store.update({ where: { id: qaStore.id }, data: { defaultPickupAddressId: qaPickup.id } });
    await prisma.storeSellerLegalIdentity.create({
      data: {
        storeId: qaStore.id,
        publicReference: `SID-KAV-${tag}`,
        identityVersion: "KAVENTRA_V1",
        legalName: "Kaventra Tech Supply (Pty) Ltd",
        tradingName: "Kaventra Tech Supply",
        vatRegistrationStatus: "NOT_REGISTERED",
        invoiceClassification: "RECEIPT",
        status: "APPROVED",
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });

    const kavPlan = await createCommissionPlan({
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${qaStore.id}`,
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 3600_000).toISOString(),
      calculationVersion: `kav-plan-${tag}`,
      rules: [{
        ruleCode: "KAVENTRA_PLATFORM_FEE",
        allocationType: "PLATFORM_COMMISSION_REVENUE",
        beneficiaryType: "PLATFORM",
        calculationMethod: "PERCENTAGE_BPS",
        rateBasisPoints: 1000,
        priority: 1,
      }],
      actorUserId: admin1.id,
      operationId: randomUUID(),
    });
    await submitCommissionPlan(kavPlan.id, admin1.id, randomUUID());
    await approveCommissionPlan(kavPlan.id, admin2.id, randomUUID());
    await activateCommissionPlan(kavPlan.id, admin2.id, randomUUID());
    kaventraCommissionPlanId = kavPlan.id;

    const liveStore = await prisma.store.create({
      data: {
        ownerUserId: liveStoreOwner.id,
        name: `Live Control Store ${tag}`,
        slug: `live-control-${tag}`,
        status: "ACTIVE",
        contactEmail: liveStoreOwner.email,
      },
    });

    const cat = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `QA Electronics ${tag}`,
        slug: `qa-elec-${tag}`,
        path: `/qa-elec-${tag}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    const pType = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `QA_HW_${tag.toUpperCase()}`,
        name: `QA Hardware ${tag}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: { attributes: [] },
        variantSchema: {},
        complianceSchema: { requirements: [] },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });

    async function seedPublishedProduct(targetStoreId: string, ownerId: string, skuPrefix: string) {
      const loc = await createStoreInventoryLocation(targetStoreId, ownerId, {
        name: `${skuPrefix} Hub`,
        operationId: randomUUID(),
      });
      const intake = new CatalogMediaIntakeService(
        new PrismaCatalogMediaRepository(),
        new DeterministicCatalogMediaStorageAdapter(),
      );
      const png = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 20, g: 80, b: 140 } } }).png().toBuffer();
      const intent = await intake.createUploadIntent({
        actorUserId: ownerId,
        ownerType: "STORE",
        storeId: targetStoreId,
        purpose: "PRODUCT_IMAGE",
        declaredMimeType: "image/png",
        declaredByteSize: png.length,
        operationId: randomUUID(),
      });
      await intake.receiveUploadBytes({ actorUserId: ownerId, storeId: targetStoreId, uploadReference: intent.upload.publicReference, operationId: randomUUID(), bytes: png });
      const media = await intake.completeUpload({ actorUserId: ownerId, storeId: targetStoreId, uploadReference: intent.upload.publicReference, operationId: randomUUID() });

      const draft = await createStoreCatalogListingDraft(targetStoreId, ownerId, {
        operationId: randomUUID(),
        product: {
          scope: "STORE_PRIVATE",
          productTypeDefinitionId: pType.id,
          primaryCategoryId: cat.id,
          title: `${skuPrefix} Optical Barcode Scanner`,
          description: "Industrial courier barcode reader for acceptance verification.",
          condition: "NEW",
          attributeValues: {},
          complianceValues: {},
        },
        variants: [],
        storeSku: `${skuPrefix}-${tag}`,
        price: { amount: "200.00", currency: "ZAR", priceIncludesTax: false, effectiveFrom: new Date(Date.now() - 60_000).toISOString() },
        openingStock: 10,
        inventoryLocationPublicReference: loc.publicReference,
        packaging: { lengthCm: 20, widthCm: 15, heightCm: 10, weightKg: 1.0, description: "Retail box" },
        modifiers: [],
        media: [{ assetPublicReference: media.asset.publicReference, altText: "Scanner", displayOrder: 0, primary: true, variantAssociation: "PRODUCT" }],
      });
      const offerRef = draft.offers[0]!.publicReference;
      const variantRef = draft.variants[0]!.publicReference;
      settingKeysToClean.push(`${PACKAGING_PREFIX}${offerRef}`);

      const subP = await submitStoreCatalogProduct(targetStoreId, draft.publicReference, ownerId, { version: draft.version, operationId: randomUUID() });
      const appP = await moderateCatalogProduct(subP.id, admin1.id, "APPROVE", { version: subP.version, operationId: randomUUID(), reasonCode: "QA_APPROVAL" });
      const subO = await transitionStoreCatalogOffer(targetStoreId, offerRef, ownerId, "SUBMITTED", { version: draft.offers[0]!.version, operationId: randomUUID() });
      const appO = await moderateCatalogOffer(subO.id, admin1.id, "APPROVE", { version: subO.version, operationId: randomUUID(), reasonCode: "QA_OFFER_APPROVAL" });
      const pub = await publishApprovedCatalogListing(appO.id, admin2.id, {
        version: appO.version,
        productVersion: appP.version,
        priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
        operationId: randomUUID(),
        reasonCode: "QA_PUBLICATION",
      });

      const pkgSetting = await prisma.systemSetting.findUniqueOrThrow({ where: { key: `${PACKAGING_PREFIX}${offerRef}` } });
      const pkgRev = (pkgSetting.value as { revision: string }).revision;
      const versions = await listTrustedPackageVersions();
      const activePkg = versions.filter((v) => v.status === "ACTIVE").sort((a, b) => b.version - a.version)[0];
      const latestVer = Math.max(0, ...versions.map((v) => v.version));
      const savedPkg = await saveTrustedPackageVersion(admin1.id, {
        packages: [
          ...(activePkg?.packages ?? []).filter((p) => p.offerReference !== offerRef),
          { storeId: targetStoreId, offerReference: offerRef, variantReference: variantRef, publicationVersion: String(pub.offer.version), modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm: 20, widthCm: 15, heightCm: 10, weightKg: 1.0, authorityReference: `${PACKAGING_PREFIX}${offerRef}:${pkgRev}` },
        ],
        bundles: activePkg?.bundles ?? [],
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        effectiveTo: null,
        expectedVersion: latestVer,
        reason: "Trusted measurement for QA acceptance",
      });
      const pkgKey = `production_marketplace_trusted_packages_v${savedPkg.version}`;
      settingKeysToClean.push(pkgKey);
      const r1 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
      await actOnTrustedPackageVersion(admin2.id, { version: savedPkg.version, expectedUpdatedAt: r1.updatedAt.toISOString(), action: "APPROVE", reason: "Independent approval" });
      const r2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
      await actOnTrustedPackageVersion(admin2.id, { version: savedPkg.version, expectedUpdatedAt: r2.updatedAt.toISOString(), action: "ACTIVATE", reason: "Activate package" });

      return { offerRef, variantRef };
    }

    const liveProduct = await seedPublishedProduct(liveStore.id, liveStoreOwner.id, "LIVE");
    liveOfferRef = liveProduct.offerRef;
    liveVariantRef = liveProduct.variantRef;
    seedPublishedProductFn = seedPublishedProduct;
  });

  afterAll(async () => {
    if (settingKeysToClean.length) {
      await prisma.systemSetting.deleteMany({ where: { key: { in: settingKeysToClean } } }).catch(() => {});
    }
    if (kaventraCommissionPlanId) {
      await prisma.commissionPlan.updateMany({ where: { id: kaventraCommissionPlanId }, data: { status: "RETIRED" } }).catch(() => {});
    }
    if (globalCourierPlanId) {
      await prisma.commissionPlan.updateMany({ where: { id: globalCourierPlanId }, data: { status: "RETIRED" } }).catch(() => {});
    }
    if (createdPolicyId) {
      await prisma.storeOrderOperationalPolicy.updateMany({ where: { id: createdPolicyId }, data: { status: "RETIRED" } }).catch(() => {});
    }
    if (createdServiceId) {
      await prisma.deliveryServiceDefinition.updateMany({ where: { id: createdServiceId }, data: { status: "RETIRED" } }).catch(() => {});
    }
    if (createdProfileIds.length) {
      await prisma.companyProfileVersion.updateMany({ where: { id: { in: createdProfileIds } }, data: { status: CompanyProfileVersionStatus.RETIRED } }).catch(() => {});
    }
    if (previousActiveCompanyProfileIds.length) {
      await prisma.companyProfileVersion.updateMany({ where: { id: { in: previousActiveCompanyProfileIds } }, data: { status: CompanyProfileVersionStatus.ACTIVE } }).catch(() => {});
    }
    if (createdRegionId) {
      await prisma.deliveryRegion.updateMany({ where: { id: createdRegionId }, data: { active: false, pricingEnabled: false } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("enrolls demo accounts, updates trading hours, certifies Kaventra privately, and hides it from public storefront & ordinary users", async () => {
    const pCust = await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: qaCustomer.id, role: "CUSTOMER", label: "Demo Customer" });
    qaCustomerPrincipalId = pCust.id;
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: kaventraOwner.id, role: "VENDOR", storeIdentifier: qaStoreId, label: "Kaventra Tech Supply" });
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: qaDriver.user.id, role: "DRIVER", label: "QA Driver" });
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: admin1.id, role: "ADMIN", label: "QA Superadmin" });

    const run = await startQaAcceptanceRun({
      actorUserId: admin1.id,
      title: `Work Mode Run ${tag}`,
      storeId: qaStoreId,
      customerUserId: qaCustomer.id,
      driverProfileId: qaDriver.profile.id,
    });
    qaRunId = run.id;

    // Update operating hours via real profile service + activate store
    await updateStoreProfile(kaventraOwner.id, { operatingHours: DEFAULT_STORE_OPERATING_HOURS });
    await setStoreStatus(qaStoreId, "ACTIVE", { actorUserId: admin1.id, reason: "QA vendor activation" });

    const kavProduct = await seedPublishedProductFn(qaStoreId, kaventraOwner.id, "KAV");
    qaOfferRef = kavProduct.offerRef;
    qaVariantRef = kavProduct.variantRef;

    // Real preflight & dual-reviewer certification (uses real buildQaSandboxProviderReadiness!)
    const preflight = await evaluateStoreCheckoutCapabilityPreflight(qaStoreId, {
      routeCalculator: async () => ({
        ok: true as const,
        route: { distanceMeters: 6400, durationSeconds: 900, routeSummary: "6.4 km", provider: "e2e_deterministic" as const },
      }),
    });
    expect(preflight?.preflightReady).toBe(true);

    const preparedCert = await prepareStoreCheckoutCertificationFromPreflight(qaStoreId, admin1.id, "QA Kaventra cert proof", {
      routeCalculator: async () => ({
        ok: true as const,
        route: { distanceMeters: 6400, durationSeconds: 900, routeSummary: "6.4 km", provider: "e2e_deterministic" as const },
      }),
    });
    const approvedCert = await approveStoreCheckoutCertification(qaStoreId, admin2.id, preparedCert.revision, {
      routeCalculator: async () => ({
        ok: true as const,
        route: { distanceMeters: 6400, durationSeconds: 900, routeSummary: "6.4 km", provider: "e2e_deterministic" as const },
      }),
    });
    expect(approvedCert.status).toBe("APPROVED");

    // Verify public storefront & search COMPLETELY HIDE Kaventra
    const [publicStores, publicLookup, publicSqlCount] = await Promise.all([
      listStorefrontStores({ limit: 50 }),
      getStorefrontStore(qaStoreSlug),
      prisma.$queryRaw<Array<{ cnt: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS cnt FROM "StorefrontStoreDocument" WHERE "storeId" = ${qaStoreId} AND ${activePublicStoreDocumentSql}`,
      ),
    ]);
    expect(publicStores.some((s) => s.slug === qaStoreSlug)).toBe(false);
    expect(publicLookup).toBeNull();
    expect(Number(publicSqlCount[0]?.cnt ?? 0)).toBe(0);

    // Anonymous & non-QA customer fail closed on QA storefront & cart access
    expect(await resolveQaAcceptanceSessionContext(null)).toBeNull();
    expect(await resolveQaVisibleStoreIdsForViewer(null)).toEqual([]);
    expect(await resolveQaAcceptanceSessionContext(ordinaryCustomer.id)).toBeNull();
    expect(await resolveQaVisibleStoreIdsForViewer(ordinaryCustomer.id)).toEqual([]);
    await expect(
      resolveMarketplaceCartLine({ offerReference: qaOfferRef, variantReference: qaVariantRef, quantity: 1, modifiers: [] }, undefined, { qaUserId: ordinaryCustomer.id }),
    ).rejects.toThrow();

    // Enrolled QA customer sees Kaventra privately at /shop/qa with structured trading hours
    const qaStores = await listQaStorefrontStores();
    const kavPublicDoc = qaStores.find((s) => s.slug === qaStoreSlug);
    expect(kavPublicDoc).toBeDefined();
    expect(kavPublicDoc?.scheduleStatus).toBe("TRADING_HOURS_CONFIGURED");
    expect(kavPublicDoc?.operatingHoursSummary).toContain("Mon: 08:00-17:00");

    const kavDetail = await getQaStorefrontStore(qaStoreSlug);
    expect(kavDetail?.products).toHaveLength(1);
    expect((await getQaStorefrontProduct(kavDetail!.products[0]!.productReference))?.offers[0]?.offerReference).toBe(qaOfferRef);
    const qaSqlCount = await prisma.$queryRaw<Array<{ cnt: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS cnt FROM "StorefrontStoreDocument" WHERE "storeId" = ${qaStoreId} AND ${activeQaStoreDocumentSql}`,
    );
    expect(Number(qaSqlCount[0]?.cnt ?? 0)).toBe(1);
  });

  it("executes full end-to-end Work mode flow: Paystack Verify recovery, bridged order, Waybill & POD PDFs, dispatch isolation, tracking, isolated earnings, and teardown", async () => {
    const baselineFinance = await getFinanceDashboard();
    const cartRepo = createPrismaMarketplaceCartRepository();
    const custOwner = { type: "CUSTOMER" as const, userId: qaCustomer.id };

    const qaSelection = await resolveMarketplaceCartLine(
      { offerReference: qaOfferRef, variantReference: qaVariantRef, quantity: 1, modifiers: [] },
      undefined,
      { qaUserId: qaCustomer.id },
    );
    let cart = await createOrResolveCart(cartRepo, custOwner, () => cartRepo.create(custOwner));
    cart = (await addCartLine(cartRepo, {
      cartId: cart.id,
      owner: custOwner,
      mutation: { operationId: `${tag}:cart-kav`, requestHash: reqHash(`${tag}:cart-kav`), expectedVersion: cart.version },
      selection: qaSelection,
    })).cart;

    // Mixing QA and live products inside checkout must be blocked
    const liveCartSelection = await resolveMarketplaceCartLine(
      { offerReference: liveOfferRef, variantReference: liveVariantRef, quantity: 1, modifiers: [] },
      undefined,
      { qaUserId: qaCustomer.id },
    );
    await expect(
      addCartLine(cartRepo, {
        cartId: cart.id,
        owner: custOwner,
        mutation: { operationId: `${tag}:cart-mix`, requestHash: reqHash(`${tag}:cart-mix`), expectedVersion: cart.version },
        selection: liveCartSelection,
      }),
    ).rejects.toThrow();

    // Start checkout -> verifies QA run & flag inheritance
    const checkout = await createMarketplaceCheckout({
      cartReference: cart.publicReference,
      owner: custOwner,
    });
    const dbCheckout = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
    expect(dbCheckout.isQaAcceptance).toBe(true);
    expect(dbCheckout.qaAcceptanceRunId).toBe(qaRunId);

    const afterContact = await updateMarketplaceCheckoutContact({
      reference: checkout.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:chk-contact`, requestHash: reqHash(`${tag}:chk-contact`), expectedVersion: dbCheckout.version },
      contact: { recipientName: "QA Recipient", email: qaCustomer.email, phone: "+27820001111", preferredContactMethod: "EMAIL" },
    });

    const afterAddress = await updateMarketplaceCheckoutAddress({
      reference: checkout.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:chk-addr`, requestHash: reqHash(`${tag}:chk-addr`), expectedVersion: afterContact.version },
      address: {
        recipientName: "QA Recipient",
        line1: "45 Commissioner Street",
        suburb: "Marshalltown",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
      },
    });

    await executeMarketplaceDeliveryQuotes({
      reference: checkout.publicReference,
      owner: custOwner,
      expectedVersion: afterAddress.version,
    });

    const reviewed = await executeMarketplaceCheckoutReview({
      reference: checkout.publicReference,
      owner: custOwner,
      operationId: `${tag}:chk-rev`,
      requestHash: reqHash(`${tag}:chk-rev`),
      expectedVersion: afterAddress.version,
    });
    const afterReviewRow = await prisma.marketplaceCheckout.findUniqueOrThrow({
      where: { id: checkout.id },
      select: { version: true },
    });
    const legal = await resolveMarketplaceLegalEvidence();
    const acked = await executeMarketplaceCheckoutAcknowledgement({
      reference: checkout.publicReference,
      owner: custOwner,
      operationId: `${tag}:chk-ack`,
      requestHash: reqHash(`${tag}:chk-ack`),
      expectedVersion: afterReviewRow.version,
      reviewVersion: reviewed.reviewVersion,
      commercialFingerprint: reviewed.commercialFingerprint,
      acknowledgedTotalReference: reviewed.grandTotal,
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
      refundPolicyReferences: [...legal.refundPolicyReferences],
    });
    await beginMarketplaceReservation({
      reference: checkout.publicReference,
      owner: custOwner,
      expectedVersion: acked.checkoutVersion,
      operationId: `${tag}:chk-res`,
      requestHash: reqHash(`${tag}:chk-res`),
    });
    const afterReserveRow = await prisma.marketplaceCheckout.findUniqueOrThrow({
      where: { id: checkout.id },
      select: { version: true },
    });

    // Stub fetch at HTTP boundary -> assert Authorization Bearer is strictly sk_test_qa40..., NEVER sk_live_!
    const authHeadersSeen: string[] = [];
    let paystackRef = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const authHeader = headers.get("authorization") ?? "";
      authHeadersSeen.push(authHeader);
      const urlStr = String(url);
      if (urlStr.includes("/transaction/initialize")) {
        const payload = JSON.parse(String(init?.body ?? "{}")) as { reference: string };
        paystackRef = payload.reference;
        return new Response(
          JSON.stringify({
            status: true,
            message: "Authorization URL created",
            data: { authorization_url: `https://checkout.paystack.com/${paystackRef}`, access_code: `ac_${paystackRef}`, reference: paystackRef },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    }));

    const preparedPay = await prepareMarketplacePayment({
      reference: checkout.publicReference,
      owner: custOwner,
      expectedVersion: afterReserveRow.version,
      operationId: `${tag}:chk-pay`,
      requestHash: reqHash(`${tag}:chk-pay`),
    });
    expect(authHeadersSeen.length).toBeGreaterThanOrEqual(1);
    expect(authHeadersSeen.every((h) => h === `Bearer ${QA_TEST_SECRET}`)).toBe(true);
    expect(paystackRef).toBeTruthy();

    const paymentRow = await prisma.payment.findUniqueOrThrow({
      where: { publicReference: preparedPay.paymentReference },
      include: { attempts: true },
    });
    expect(paymentRow.isQaAcceptance).toBe(true);
    const attempt = paymentRow.attempts[0]!;

    // Settle via Paystack Verify API recovery (no webhook event needed)
    const verifyClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: randomInt(100_000, 999_999),
        status: "success",
        reference: attempt.merchantReference,
        amount: Math.round(Number(preparedPay.amount) * 100),
        currency: "ZAR",
      }),
    };
    const recovery = await recoverPaystackAttemptViaVerify({
      attemptId: attempt.id,
      trigger: "qa_e2e_verify",
      clientOverride: verifyClient as never,
    });
    expect(recovery.recovered).toBe(true);

    // Finalization hook should have created QA MarketplaceOrder + MarketplaceStoreOrder
    const mktOrder = await prisma.marketplaceOrder.findUniqueOrThrow({
      where: { checkoutId: checkout.id },
      include: { storeOrders: { include: { lines: true } } },
    });
    expect(mktOrder.isQaAcceptance).toBe(true);
    const storeOrder = mktOrder.storeOrders[0]!;
    expect(storeOrder.isQaAcceptance).toBe(true);

    // Settle isolated store commission & store earning -> isolated wallet only!
    const settled = await settleMarketplaceStoreOrder(
      { marketplaceStoreOrderReference: storeOrder.publicReference, operationId: `${tag}:settle` },
      createPrismaMarketplaceSettlementRepository(),
    );
    expect(settled.commissionAccrualReference).toBeTruthy();
    expect(settled.storeEarningReference).toBeTruthy();

    // Vendor store order review -> accept -> bridge -> prep -> handoff
    await initializeMarketplaceStoreOrderOperations({ storeOrderReference: storeOrder.publicReference, operationId: `${tag}:so-init`, requestHash: reqHash(`${tag}:so-init`) });
    await beginStoreOrderReview({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, operationId: `${tag}:so-rev`, requestHash: reqHash(`${tag}:so-rev`) });
    await confirmStoreOrderLineAvailability({ storeOrderReference: storeOrder.publicReference, orderLineId: storeOrder.lines[0]!.id, actorUserId: kaventraOwner.id, availableQuantity: 1, operationId: `${tag}:so-avail`, requestHash: reqHash(`${tag}:so-avail`) });
    await acceptMarketplaceStoreOrder({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, preparationMinutes: 15, pickupInstructions: "Collect from QA Dispatch Desk", operationId: `${tag}:so-acc`, requestHash: reqHash(`${tag}:so-acc`) });
    const bridged = await createMarketplaceDeliveryBridge({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, operationId: `${tag}:so-bridge`, requestHash: reqHash(`${tag}:so-bridge`) });
    if (!("courierOrderReference" in bridged) || typeof bridged.courierOrderReference !== "string") {
      throw new Error("Expected bridged courierOrderReference.");
    }
    await startStoreOrderPreparation({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, operationId: `${tag}:so-prep`, requestHash: reqHash(`${tag}:so-prep`) });
    await markStoreOrderReadyForHandoff({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, operationId: `${tag}:so-ready`, requestHash: reqHash(`${tag}:so-ready`) });

    const courierOrder = await prisma.order.findUniqueOrThrow({ where: { orderNumber: bridged.courierOrderReference } });
    expect(courierOrder.isQaAcceptance).toBe(true);
    expect(courierOrder.qaAcceptanceRunId).toBe(qaRunId);

    // Waybill PDF available immediately on bridged courier order
    const waybillPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: qaCustomer,
      orderId: courierOrder.id,
      type: "WAYBILL",
    });
    expect(Buffer.from(waybillPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const parsedWaybillPdf = await PDFDocument.load(waybillPdf.bytes);
    expect(parsedWaybillPdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(parsedWaybillPdf.getTitle()).toContain("QA Test Waybill");
    expect(parsedWaybillPdf.getSubject()).toContain("QA SANDBOX TEST - NON-COMMERCIAL");

    // Dispatch cross-boundary negative check & filtered eligibility list:
    const qaEligibleDrivers = await listEligibleDrivers(courierOrder.deliveryRegionId, {
      orderId: courierOrder.id,
      isQaAcceptance: true,
      qaAcceptanceRunId: qaRunId,
    });
    expect(qaEligibleDrivers.notEligible.some((d) => d.id === liveDriver.profile.id)).toBe(true);
    expect(
      [...qaEligibleDrivers.recommended, ...qaEligibleDrivers.available].some(
        (d) => d.id === liveDriver.profile.id,
      ),
    ).toBe(false);

    await expect(
      offerAssignment(admin1.id, courierOrder.id, { driverProfileId: liveDriver.profile.id, reasonCode: "CROSS_CHECK" }),
    ).rejects.toThrow();

    const liveOrder = await prisma.order.create({
      data: {
        orderNumber: `KT-LIVE-${tag.toUpperCase()}`,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.CONFIRMED,
        deliveryType: DeliveryType.SAME_DAY,
        currency: "ZAR",
        customerId: ordinaryCustomer.id,
        priceEstimate: "110.00",
        isQaAcceptance: false,
      },
    });
    await expect(
      offerAssignment(admin1.id, liveOrder.id, { driverProfileId: qaDriver.profile.id, reasonCode: "CROSS_CHECK" }),
    ).rejects.toThrow();
    const liveEligibleDrivers = await listEligibleDrivers(courierOrder.deliveryRegionId, {
      orderId: liveOrder.id,
      isQaAcceptance: false,
      qaAcceptanceRunId: null,
    });
    expect(liveEligibleDrivers.notEligible.some((d) => d.id === qaDriver.profile.id)).toBe(true);

    // Commercial accounts with non-QA activity must never be accidentally enrolled into QA
    await expect(
      enrollQaAcceptancePrincipal({
        actorUserId: admin1.id,
        userIdentifier: ordinaryCustomer.id,
        role: "CUSTOMER",
        label: "Accidental Commercial Customer",
      }),
    ).rejects.toMatchObject({ code: "QA_ISOLATION_VIOLATION" });
    await expect(
      enrollQaAcceptancePrincipal({
        actorUserId: admin1.id,
        userIdentifier: liveStoreOwner.id,
        role: "VENDOR",
        label: "Accidental Commercial Store",
      }),
    ).rejects.toMatchObject({ code: "QA_ISOLATION_VIOLATION" });

    // Dispatch to QA driver & verify full custody + tracking + POD + settlement
    const assignment = await offerAssignment(admin1.id, courierOrder.id, { driverProfileId: qaDriver.profile.id, reasonCode: "QA_DISPATCH" });
    await acceptDispatchAssignment(qaDriver.profile.id, assignment.id, { expectedVersion: assignment.version });

    const challenge = await generateStoreOrderPickupChallenge({ storeOrderReference: storeOrder.publicReference, actorUserId: kaventraOwner.id, operationId: `${tag}:so-chal`, requestHash: reqHash(`${tag}:so-chal`) });
    await verifyStoreOrderPickupHandoff({
      storeOrderReference: storeOrder.publicReference,
      driverUserId: qaDriver.user.id,
      driverProfileId: qaDriver.profile.id,
      pickupCode: (challenge as unknown as { pickupCode: string }).pickupCode,
      packageEvidence: { packageCount: 1 },
      operationId: `${tag}:so-handoff`,
      requestHash: reqHash(`${tag}:so-handoff`),
    });

    await prisma.$transaction((tx) =>
      transitionOrderStatusInTx(tx, {
        orderId: courierOrder.id,
        fromStatus: OrderStatus.PICKED_UP,
        toStatus: OrderStatus.IN_TRANSIT,
        actorUserId: qaDriver.user.id,
        actorRole: "DRIVER",
        source: "qa_transit",
        context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true },
      }),
    );

    const shareGrant = await issueTrackingShareGrant({ user: qaCustomer, orderId: courierOrder.id, ttlDays: 2 });
    const rawToken = decodeURIComponent(shareGrant.shareUrl.split("#token=")[1] ?? "");
    const guestTracking = await verifyAndResolveTrackingToken(rawToken, shareGrant.grant.grantRef);
    expect(guestTracking?.projection.orderNumber).toBe(courierOrder.orderNumber);
    expect(JSON.stringify(guestTracking?.projection)).not.toContain("45 Commissioner Street");

    const manualRes = await adminManualDeliveryComplete(courierOrder.id, admin1.id, admin1.role, {
      recipientName: "QA Recipient",
      reason: "QA Issue #40 acceptance delivery confirmed cleanly.",
    });
    expect(manualRes).toEqual({ ok: true });

    const avail = await getOrderDocumentAvailability(courierOrder.id);
    expect(avail.waybill.issued).toBe(true);
    expect(avail.pod.issued).toBe(true);

    const podPdf = await downloadAuthorizedShipmentDocumentPdf({
      user: qaCustomer,
      orderId: courierOrder.id,
      type: "POD",
    });
    expect(Buffer.from(podPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    const parsedPodPdf = await PDFDocument.load(podPdf.bytes);
    expect(parsedPodPdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(parsedPodPdf.getTitle()).toContain("QA Test Proof of Delivery");
    expect(parsedPodPdf.getSubject()).toContain("QA SANDBOX TEST - NON-COMMERCIAL");

    const drvSettlement = await produceDriverSettlement(courierOrder.id);
    expect(drvSettlement.publicReference).toBeTruthy();

    // Verify assignment capacity released after courierOrder completion
    const completedFirstAssign = await prisma.orderAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
    });
    expect(completedFirstAssign.status).toBe("COMPLETED");
    expect(completedFirstAssign.activeOrderGuard).toBeNull();
    const completedFirstOrder = await prisma.order.findUniqueOrThrow({
      where: { id: courierOrder.id },
      select: { currentDriverProfileId: true },
    });
    expect(completedFirstOrder.currentDriverProfileId).toBeNull();

    // ── Standalone QA Parcel Order: Server-Enforced QA_SIMULATED GPS Completion ──
    let tempPaymentPolicyId: string | null = null;
    const activeParcelPolicies = await prisma.paymentMethodPolicy.findMany({
      where: {
        deliveryServiceId: "CLIENT_STANDARD",
        orderType: "PARCEL_DOCUMENT",
        status: "ACTIVE",
      },
    });
    const existingParcelPolicy = activeParcelPolicies.find(
      (policy) => Array.isArray(policy.provinceScope) && policy.provinceScope.includes("Gauteng"),
    );
    if (!existingParcelPolicy) {
      const createdPol = await prisma.paymentMethodPolicy.create({
        data: {
          deliveryServiceId: "CLIENT_STANDARD",
          orderType: "PARCEL_DOCUMENT",
          provinceScope: ["Gauteng"],
          versionNumber: 1,
          status: "ACTIVE",
          mode: "DIGITAL",
          effectiveFrom: new Date(Date.now() - 3600_000),
          createdByUserId: admin1.id,
        },
      });
      tempPaymentPolicyId = createdPol.id;
    }

    try {
      const parcelQuote = await createPublicQuote({
        serviceKey: "CLIENT_STANDARD",
        parcelSize: "SMALL",
        weightKg: "1.5",
        pickupAddress: {
          line1: "22 Sandton Drive",
          line2: "Sandhurst",
          suburb: "Sandton",
          city: "Sandton",
          province: "Gauteng",
          postalCode: "2196",
        },
        dropoffAddress: {
          line1: "45 Commissioner Street",
          line2: "Suite 2",
          suburb: "Marshalltown",
          city: "Johannesburg",
          province: "Gauteng",
          postalCode: "2001",
        },
      });
      const parcelQuoteRow = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: parcelQuote.id } });
      const parcelMeta = (
        parcelQuoteRow.metadata as {
          bookingInput: {
            deliveryType: "PARCEL_DOCUMENT";
            pickupAddress: Record<string, unknown>;
            dropoffAddress: Record<string, unknown>;
            actualWeightKg: string;
          };
        }
      ).bookingInput;

      const parcelOrderDto = await prisma.$transaction(async (tx) => {
        await tx.pricingQuote.update({
          where: { id: parcelQuote.id },
          data: { ownerId: qaCustomer.id, ownerType: "CUSTOMER", storeId: null },
        });
        return createOrder(
          qaCustomer,
          {
            deliveryType: parcelMeta.deliveryType,
            pickupAddress: parcelMeta.pickupAddress as Parameters<typeof createOrder>[1]["pickupAddress"],
            dropoffAddress: parcelMeta.dropoffAddress as Parameters<typeof createOrder>[1]["dropoffAddress"],
            actualWeightKg: parcelMeta.actualWeightKg,
            pricingQuoteId: parcelQuote.id,
            recipientName: "QA Parcel Recipient",
            recipientPhone: "+27825550999",
            recipientEmail: qaCustomer.email,
            parcelDescription: "QA GPS Simulation Parcel",
            parcelCount: 1,
            paymentMethod: "DIGITAL_ONLY",
          },
          false,
          tx,
          undefined,
          { isQaAcceptance: true, qaAcceptanceRunId: qaRunId },
        );
      });

      const parcelPaymentPrep = await prepareOrderPayment(qaCustomer, {
        orderId: parcelOrderDto.id,
        idempotencyKey: `${tag}:parcel-prep`,
      });
      const parcelPaymentRow = await prisma.payment.findUniqueOrThrow({
        where: { publicReference: parcelPaymentPrep.publicReference },
      });
      expect(parcelPaymentRow.isQaAcceptance).toBe(true);

      const parcelSession = await createProviderCheckoutSession(
        { id: qaCustomer.id },
        {
          paymentId: parcelPaymentRow.id,
          provider: "PAYSTACK",
          idempotencyKey: `${tag}:parcel-sess`,
        },
      );
      const parcelVerify = await recoverPaystackAttemptViaVerify({
        attemptId: parcelSession.attempt.id,
        trigger: "qa_parcel_sim_gps_verify",
        clientOverride: {
          verifyTransaction: vi.fn().mockResolvedValue({
            id: randomInt(100_000, 999_999),
            status: "success",
            reference: parcelSession.attempt.merchantReference,
            amount: Math.round(Number(parcelPaymentPrep.amount) * 100),
            currency: "ZAR",
          }),
        } as never,
      });
      expect(parcelVerify.recovered).toBe(true);

      // Driver capacity was released -> qaDriver can take the paid standalone QA parcel order
      const parcelOffer = await offerAssignment(admin1.id, parcelOrderDto.id, {
        driverProfileId: qaDriver.profile.id,
        reasonCode: "QA_PARCEL_DISPATCH",
      });
      await acceptDispatchAssignment(qaDriver.profile.id, parcelOffer.id, {
        expectedVersion: parcelOffer.version,
      });
      const parcelDetail = await getDriverAssignmentDetail(parcelOffer.id, qaDriver.profile.id);
      expect(parcelDetail?.qaSimulationAllowed).toBe(true);

      // Also verify QA pickup simulation works cleanly at PICKUP_SCHEDULED right after accept
      const acceptVerAtPickup = (await prisma.orderAssignment.findUniqueOrThrow({
        where: { id: parcelOffer.id },
        select: { version: true },
      })).version;
      const pickupSim = await recordQaSimulatedDriverLocation(parcelOffer.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: acceptVerAtPickup,
        mode: "QA_SIMULATED",
      });
      expect(pickupSim.validationStatus).toBe("ACCEPTED");
      expect(pickupSim.source).toBe("QA_SIMULATED");

      // Advance parcel order into IN_TRANSIT (acceptDispatchAssignment already placed it in PICKUP_SCHEDULED)
      await prisma.$transaction(async (tx) => {
        await transitionOrderStatusInTx(tx, {
          orderId: parcelOrderDto.id,
          fromStatus: OrderStatus.PICKUP_SCHEDULED,
          toStatus: OrderStatus.PICKED_UP,
          actorUserId: qaDriver.user.id,
          actorRole: "DRIVER",
          source: "qa_parcel_picked_up",
          context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true, hasPickupProof: true },
        });
        await transitionOrderStatusInTx(tx, {
          orderId: parcelOrderDto.id,
          fromStatus: OrderStatus.PICKED_UP,
          toStatus: OrderStatus.IN_TRANSIT,
          actorUserId: qaDriver.user.id,
          actorRole: "DRIVER",
          source: "qa_parcel_transit",
          context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true },
        });
      });

      const acceptedVersionRow = await prisma.orderAssignment.findUniqueOrThrow({
        where: { id: parcelOffer.id },
        select: { version: true },
      });

      // Negative 1: Wrong driver cannot trigger QA location simulation on parcelOffer
      await expect(
        recordQaSimulatedDriverLocation(parcelOffer.id, liveDriver.profile.id, liveDriver.user.id, {
          operationId: randomUUID(),
          assignmentVersion: acceptedVersionRow.version,
          mode: "QA_SIMULATED",
        }),
      ).rejects.toThrow();

      // Negative 2: Commercial shipment rejects QA_SIMULATED both at recording and completion
      await prisma.order.update({
        where: { id: liveOrder.id },
        data: { deliveryRegionId: createdRegionId },
      });
      const liveAssignOffer = await offerAssignment(admin1.id, liveOrder.id, {
        driverProfileId: liveDriver.profile.id,
        reasonCode: "COMMERCIAL_CONTROL",
      });
      const liveAcceptRow = await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: liveOrder.id },
          data: { status: OrderStatus.IN_TRANSIT, currentDriverProfileId: liveDriver.profile.id },
        });
        return tx.orderAssignment.update({
          where: { id: liveAssignOffer.id },
          data: { status: "ACCEPTED", acceptedAt: new Date(), version: { increment: 1 } },
        });
      });
      const liveAssignDetail = await getDriverAssignmentDetail(liveAcceptRow.id, liveDriver.profile.id);
      expect(liveAssignDetail?.qaSimulationAllowed).toBe(false);
      await expect(
        recordQaSimulatedDriverLocation(liveAcceptRow.id, liveDriver.profile.id, liveDriver.user.id, {
          operationId: randomUUID(),
          assignmentVersion: liveAcceptRow.version,
          mode: "QA_SIMULATED",
        }),
      ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
      await prisma.$executeRaw`
        INSERT INTO "DriverLocationEvidence"
          ("id", "publicReference", "orderId", "assignmentId", "driverProfileId", "latitude", "longitude", "accuracyMeters", "source", "validationStatus", "clientCapturedAt", "receivedAt", "createdAt")
        VALUES
          (${`dloc_${randomUUID().replaceAll("-", "")}`}, ${`dloc_${randomUUID().replaceAll("-", "")}`}, ${liveOrder.id}, ${liveAcceptRow.id}, ${liveDriver.profile.id}, ${-26.1076}, ${28.0567}, ${10}, ${"QA_SIMULATED"}::"DriverLocationSource", ${"ACCEPTED"}::"DriverLocationValidationStatus", ${new Date()}, ${new Date()}, ${new Date()})
      `;
      await expect(
        prisma.$transaction((tx) =>
          requireVerifiedDeliveryLocationInTx(tx, {
            orderId: liveOrder.id,
            assignmentId: liveAcceptRow.id,
            driverProfileId: liveDriver.profile.id,
          }),
        ),
      ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
      await prisma.$transaction(async (tx) => {
        await tx.orderAssignment.update({
          where: { id: liveAcceptRow.id },
          data: { status: "CANCELLED", activeOrderGuard: null },
        });
        await tx.order.update({
          where: { id: liveOrder.id },
          data: { currentDriverProfileId: null },
        });
      });

      // Negative 3: Cross-run QA order rejects wrong QA driver / run mismatch
      const otherQaDriver = await createDriver(`${tag}-qa2drv`, createdRegionId!, 3);
      await prisma.driverProfile.update({
        where: { id: otherQaDriver.profile.id },
        data: { onboardingStatus: "APPROVED" },
      });
      await enrollQaAcceptancePrincipal({
        actorUserId: admin1.id,
        userIdentifier: otherQaDriver.user.id,
        role: "DRIVER",
        label: "Secondary QA Driver",
      });
      const otherQaRun = await startQaAcceptanceRun({
        actorUserId: admin1.id,
        title: `Secondary Run ${tag}`,
        driverProfileId: otherQaDriver.profile.id,
      });
      let otherQaRunArchived = false;
      try {
        const { crossRunOrder, crossAssign, revokedTestOrder, otherQaDriverAssign } = await prisma.$transaction(async (tx) => {
          const cOrder = await tx.order.create({
            data: {
              orderNumber: `KT-QARUN2-${tag.toUpperCase()}`,
              source: OrderSource.CUSTOMER,
              status: OrderStatus.IN_TRANSIT,
              deliveryType: DeliveryType.SAME_DAY,
              currency: "ZAR",
              customerId: qaCustomer.id,
              priceEstimate: "95.00",
              isQaAcceptance: true,
              qaAcceptanceRunId: otherQaRun.id,
              currentDriverProfileId: qaDriver.profile.id,
            },
          });
          const cAssign = await tx.orderAssignment.create({
            data: {
              orderId: cOrder.id,
              driverProfileId: qaDriver.profile.id,
              status: "ACCEPTED",
              activeOrderGuard: cOrder.id,
              assignedByAdminId: admin1.id,
              assignedAt: new Date(),
              acceptedAt: new Date(),
              version: 1,
            },
          });
          const rOrder = await tx.order.create({
            data: {
              orderNumber: `KT-QARUN2B-${tag.toUpperCase()}`,
              source: OrderSource.CUSTOMER,
              status: OrderStatus.IN_TRANSIT,
              deliveryType: DeliveryType.SAME_DAY,
              currency: "ZAR",
              customerId: qaCustomer.id,
              priceEstimate: "95.00",
              isQaAcceptance: true,
              qaAcceptanceRunId: otherQaRun.id,
              currentDriverProfileId: otherQaDriver.profile.id,
            },
          });
          const rAssign = await tx.orderAssignment.create({
            data: {
              orderId: rOrder.id,
              driverProfileId: otherQaDriver.profile.id,
              status: "ACCEPTED",
              activeOrderGuard: rOrder.id,
              assignedByAdminId: admin1.id,
              assignedAt: new Date(),
              acceptedAt: new Date(),
              version: 1,
            },
          });
          return { crossRunOrder: cOrder, crossAssign: cAssign, revokedTestOrder: rOrder, otherQaDriverAssign: rAssign };
        });
        await expect(
          recordQaSimulatedDriverLocation(crossAssign.id, qaDriver.profile.id, qaDriver.user.id, {
            operationId: randomUUID(),
            assignmentVersion: crossAssign.version,
            mode: "QA_SIMULATED",
          }),
        ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });

        // Negative 4: Revoked driver principal is rejected even while the QA run itself remains ACTIVE
        const otherQaDriverPrincipal = await prisma.qaAcceptancePrincipal.findFirstOrThrow({
          where: { userId: otherQaDriver.user.id, active: true },
        });
        await revokeQaAcceptancePrincipal({
          actorUserId: admin1.id,
          principalId: otherQaDriverPrincipal.id,
          reason: "Verify revoked QA driver cannot simulate location on active run",
        });
        await expect(
          recordQaSimulatedDriverLocation(otherQaDriverAssign.id, otherQaDriver.profile.id, otherQaDriver.user.id, {
            operationId: randomUUID(),
            assignmentVersion: otherQaDriverAssign.version,
            mode: "QA_SIMULATED",
          }),
        ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
        await prisma.$transaction(async (tx) => {
          await tx.orderAssignment.updateMany({
            where: { id: { in: [crossAssign.id, otherQaDriverAssign.id] } },
            data: { status: "CANCELLED", activeOrderGuard: null },
          });
          await tx.order.updateMany({
            where: { id: { in: [crossRunOrder.id, revokedTestOrder.id] } },
            data: { currentDriverProfileId: null },
          });
        });
      } finally {
        if (!otherQaRunArchived) {
          otherQaRunArchived = true;
          await updateQaAcceptanceRunLifecycle({
            actorUserId: admin1.id,
            runId: otherQaRun.id,
            action: "ARCHIVE_AND_TEARDOWN",
            reason: "Clean up secondary QA run fixture",
          }).catch(() => {});
        }
      }

      // Simulate earlier browser desk DEVICE_GPS sample thousands of km away, then clear dropoff coords to test backfill
      const parcelRowFull = await prisma.order.findUniqueOrThrow({
        where: { id: parcelOrderDto.id },
        select: { dropoffAddressId: true },
      });
      await recordDriverLocationSample(parcelOffer.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: acceptedVersionRow.version,
        latitude: -33.9249,
        longitude: 18.4241,
        clientCapturedAt: new Date().toISOString(),
        accuracyMeters: 25,
        source: "DEVICE_GPS",
      });
      if (parcelRowFull.dropoffAddressId) {
        await prisma.address.update({
          where: { id: parcelRowFull.dropoffAddressId },
          data: { latitude: null, longitude: null },
        });
      }

      // Server-enforced QA location simulation -> resolves coordinates + backfills null address + writes QA_SIMULATED evidence
      const simLocation = await recordQaSimulatedDriverLocation(parcelOffer.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: acceptedVersionRow.version,
        mode: "QA_SIMULATED",
      });
      expect(simLocation.validationStatus).toBe("ACCEPTED");
      expect(simLocation.source).toBe("QA_SIMULATED");
      expect(simLocation.isQaSimulated).toBe(true);

      const dbEvidence = await prisma.driverLocationEvidence.findFirstOrThrow({
        where: { publicReference: simLocation.reference },
      });
      expect(dbEvidence.source).toBe("QA_SIMULATED");
      expect(dbEvidence.validationStatus).toBe("ACCEPTED");

      const trackingProj = await getLatestSafeDriverLocationProjection(parcelOffer.id, qaDriver.profile.id);
      expect(trackingProj).toMatchObject({ source: "QA_SIMULATED", isQaSimulated: true, validationStatus: "ACCEPTED" });
      const mapPoints = trackingMapPoints({ data: { active: true, latestKnownLocation: trackingProj } }, "PARCEL", parcelOrderDto.orderNumber);
      expect(mapPoints).toHaveLength(1);
      expect(mapPoints[0]?.isQaSimulated).toBe(true);

      // Responsibilities + OTP + Canonical completeDelivery
      await recordDriverDeliveryResponsibility({
        assignmentId: parcelOffer.id,
        driverProfileId: qaDriver.profile.id,
        driverUserId: qaDriver.user.id,
        assignmentVersion: acceptedVersionRow.version,
        reportType: "SAFETY_CHECK",
        operationId: randomUUID(),
      });
      await recordDriverDeliveryResponsibility({
        assignmentId: parcelOffer.id,
        driverProfileId: qaDriver.profile.id,
        driverUserId: qaDriver.user.id,
        assignmentVersion: acceptedVersionRow.version,
        reportType: "LAWFUL_TRANSPORT_CONFIRMATION",
        operationId: randomUUID(),
      });

      const parcelOtp = await generateAndSendDeliveryOtp(parcelOffer.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: acceptedVersionRow.version,
        stage: "DELIVERY",
      });
      if (!parcelOtp.ok) throw new Error(parcelOtp.error);
      const otpCode = getTestIssuedDeliveryOtp(parcelOtp.otpId);

      const completedParcelRes = await completeDelivery(parcelOffer.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: acceptedVersionRow.version,
        otpCode,
        recipientName: "QA Parcel Recipient",
        recipientPhone: "+27825550999",
        publicNote: "Delivered in isolated QA lane via simulated location.",
        driverNote: "QA desktop browser verification",
        confirmDelivery: true,
      });
      expect(completedParcelRes.ok).toBe(true);

      // Assignment capacity released & order driver unassigned cleanly
      const finishedParcelAssign = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: parcelOffer.id } });
      expect(finishedParcelAssign.status).toBe("COMPLETED");
      expect(finishedParcelAssign.activeOrderGuard).toBeNull();
      const finishedParcelOrder = await prisma.order.findUniqueOrThrow({
        where: { id: parcelOrderDto.id },
        include: { proofOfDelivery: true },
      });
      expect(finishedParcelOrder.status).toBe(OrderStatus.DELIVERED);
      expect(finishedParcelOrder.currentDriverProfileId).toBeNull();
      expect(finishedParcelOrder.proofOfDelivery?.method).toBe("OTP");
      expect(finishedParcelOrder.proofOfDelivery?.internalNote).toContain("QA_SIMULATED");

      // Canonical QA POD PDF discloses QA Test + QA Simulated Proximity (never genuine GPS)
      const parcelPodPdf = await downloadAuthorizedShipmentDocumentPdf({
        user: qaCustomer,
        orderId: parcelOrderDto.id,
        type: "POD",
      });
      expect(Buffer.from(parcelPodPdf.bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
      const parsedParcelPodPdf = await PDFDocument.load(parcelPodPdf.bytes);
      expect(parsedParcelPodPdf.getTitle()).toContain("QA Test Proof of Delivery");
      expect(parsedParcelPodPdf.getSubject()).toContain("QA SANDBOX TEST - NON-COMMERCIAL");
      const podDocRow = await prisma.shipmentDocument.findFirstOrThrow({
        where: { orderId: parcelOrderDto.id, type: "POD", status: "ISSUED" },
      });
      expect((podDocRow.payloadSnapshot as { proofMethodLabel?: string; verificationSummary?: string }).proofMethodLabel).toContain("QA Simulated Proximity");
      expect((podDocRow.payloadSnapshot as { verificationSummary?: string }).verificationSummary).toContain("QA_SIMULATED");

      // Isolated QA driver earnings settlement
      const parcelSettlement = await produceDriverSettlement(parcelOrderDto.id);
      expect(parcelSettlement.publicReference).toBeTruthy();
      const parcelEarning = await prisma.driverEarning.findUniqueOrThrow({
        where: { publicReference: parcelSettlement.publicReference },
      });
      expect(parcelEarning.isQaAcceptance).toBe(true);
    } finally {
      if (tempPaymentPolicyId) {
        await prisma.paymentMethodPolicy.updateMany({ where: { id: tempPaymentPolicyId }, data: { status: "RETIRED" } }).catch(() => {});
      }
    }

    // Financial isolation & commercial reporting checks
    const afterFinance = await getFinanceDashboard();
    expect(afterFinance.commissions.accrued).toBe(baselineFinance.commissions.accrued);
    expect(afterFinance.storeEarnings.totalAccrued).toBe(baselineFinance.storeEarnings.totalAccrued);
    expect(afterFinance.driverEarnings.totalAccrued).toBe(baselineFinance.driverEarnings.totalAccrued);
    expect(afterFinance.refunds.walletLiabilities).toBe(baselineFinance.refunds.walletLiabilities);

    // Withdrawal requests MUST be blocked for QA wallets
    await expect(
      createWithdrawalRequest({
        actorUserId: kaventraOwner.id,
        amount: "10.00",
        payoutDestinationPublicReference: "dest_nonexistent_or_qa",
        operationId: `${tag}:wdr-store`,
      }),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });
    await expect(
      createWithdrawalRequest({
        actorUserId: qaDriver.user.id,
        amount: "10.00",
        payoutDestinationPublicReference: "dest_nonexistent_or_qa",
        operationId: `${tag}:wdr-driver`,
      }),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });

    // Verify sandbox platform wallet holds QA commission + clearing/held entries
    const sandboxWallet = await prisma.wallet.findUniqueOrThrow({
      where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform-sandbox-acceptance", currency: "ZAR" } },
      include: { accounts: true },
    });
    expect(sandboxWallet.isQaIsolated).toBe(true);
    expect(sandboxWallet.accounts.some((a) => a.purpose === "PLATFORM_REVENUE" && !a.currentBalance.isZero())).toBe(true);

    // Teardown & principal revocation preserve immutable orders/docs/ledger while hiding QA lane
    const archived = await updateQaAcceptanceRunLifecycle({
      actorUserId: admin1.id,
      runId: qaRunId,
      action: "ARCHIVE_AND_TEARDOWN",
      reason: "Issue #40 automated test teardown",
    });
    expect(archived.status).toBe("ARCHIVED");
    // Archived run alone immediately revokes QA session, storefront access, and QA GPS simulation
    expect(await resolveQaAcceptanceSessionContext(qaCustomer.id)).toBeNull();
    expect(await resolveQaVisibleStoreIdsForViewer(qaCustomer.id)).toEqual([]);
    const revokedCheckOrder = await prisma.order.findFirstOrThrow({
      where: { qaAcceptanceRunId: qaRunId, source: OrderSource.CUSTOMER, status: OrderStatus.DELIVERED },
      include: { assignments: { take: 1 } },
    });
    const revokedAssign = revokedCheckOrder.assignments[0]!;
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: revokedCheckOrder.id },
        data: { status: OrderStatus.IN_TRANSIT, currentDriverProfileId: qaDriver.profile.id },
      });
      await tx.orderAssignment.update({
        where: { id: revokedAssign.id },
        data: { status: "ACCEPTED", activeOrderGuard: revokedCheckOrder.id },
      });
    });
    await expect(
      recordQaSimulatedDriverLocation(revokedAssign.id, qaDriver.profile.id, qaDriver.user.id, {
        operationId: randomUUID(),
        assignmentVersion: revokedAssign.version,
        mode: "QA_SIMULATED",
      }),
    ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
    await expect(
      prisma.$transaction((tx) =>
        requireVerifiedDeliveryLocationInTx(tx, {
          orderId: revokedCheckOrder.id,
          assignmentId: revokedAssign.id,
          driverProfileId: qaDriver.profile.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
    await prisma.$transaction(async (tx) => {
      await tx.orderAssignment.update({
        where: { id: revokedAssign.id },
        data: { status: "COMPLETED", activeOrderGuard: null },
      });
      await tx.order.update({
        where: { id: revokedCheckOrder.id },
        data: { status: OrderStatus.DELIVERED, currentDriverProfileId: null },
      });
    });

    const qaDriverPrincipal = await prisma.qaAcceptancePrincipal.findFirstOrThrow({
      where: { userId: qaDriver.user.id, active: true },
    });
    await revokeQaAcceptancePrincipal({ actorUserId: admin1.id, principalId: qaDriverPrincipal.id, reason: "End of driver run" });
    await revokeQaAcceptancePrincipal({ actorUserId: admin1.id, principalId: qaCustomerPrincipalId, reason: "End of run" });
    expect(await resolveQaAcceptanceSessionContext(qaCustomer.id)).toBeNull();
    expect(await prisma.shipmentDocument.count({ where: { orderId: courierOrder.id, status: "ISSUED" } })).toBe(2);
    expect(await prisma.storeEarning.count({ where: { storeId: qaStoreId, isQaAcceptance: true } })).toBe(1);
    expect(await prisma.driverEarning.count({ where: { orderId: courierOrder.id, isQaAcceptance: true } })).toBe(1);
  });
});
