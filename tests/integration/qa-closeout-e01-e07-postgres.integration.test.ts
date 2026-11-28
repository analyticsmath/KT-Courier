import { randomInt, randomUUID, createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  CompanyProfileVersionStatus,
  DeliveryType,
  OrderSource,
  OrderStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";
import { prisma } from "@/lib/db/prisma";
import { installSystemPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { activateCompanyProfile } from "@/lib/services/company-profile.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";
import {
  actOnDeliveryMatrix,
  listDeliveryMatrices,
  saveDeliveryMatrix,
} from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { resolveMarketplaceLegalEvidence } from "@/lib/marketplace-checkout/legal-evidence";
import { createLegalDocumentDraft, publishLegalDocumentVersion } from "@/lib/services/legal-documents.service";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import {
  CatalogMediaIntakeService,
  PrismaCatalogMediaRepository,
} from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { moderateCatalogOffer, moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
import { transitionStoreCatalogOffer, updateStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersionsSafely,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import {
  enrollQaAcceptancePrincipal,
  getQaAcceptanceDashboard,
  startQaAcceptanceRun,
  updateQaAcceptanceRunLifecycle,
} from "@/lib/qa-acceptance/service";
import { DEFAULT_STORE_OPERATING_HOURS } from "@/lib/qa-acceptance/operating-hours";
import { updateStoreProfile } from "@/lib/services/profiles.service";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
import { getStoreOnboardingByStoreId } from "@/lib/services/store-onboarding.service";
import { diagnoseStoreOffersSellability } from "@/lib/admin/store-offer-diagnostics.service";
import {
  recordQaSyntheticPackageDraft,
  reviewAndActivateQaSyntheticPackaging,
} from "@/lib/qa-acceptance/synthetic-packaging";
import {
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  prepareStoreCheckoutCertificationFromPreflight,
} from "@/lib/admin/store-checkout-certification.service";
import {
  getQaStorefrontStore,
  listQaStorefrontStores,
  listStorefrontStores,
} from "@/lib/services/storefront-catalog.service";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { addCartLine, createOrResolveCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import {
  beginMarketplaceReservation,
  cancelMarketplaceCheckout,
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
import { recoverPaystackAttemptViaVerify } from "@/lib/services/paystack-verify-recovery.service";
import { createPublicQuote } from "@/lib/client-platform/delivery.service";
import { createOrder } from "@/lib/services/orders.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { recordQaSimulatedDriverLocation } from "@/lib/services/driver-location-evidence.service";
import { recordDriverDeliveryResponsibility } from "@/lib/services/shipping-obligations.service";
import { generateAndSendDeliveryOtp, getTestIssuedDeliveryOtp } from "@/lib/services/delivery-otp.service";
import { completeDelivery } from "@/lib/services/delivery-execution.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import {
  activateCommissionPlan,
  approveCommissionPlan,
  createCommissionPlan,
  submitCommissionPlan,
} from "@/lib/services/commission-plan.service";
import {
  diagnoseDriverSettlementReadiness,
  produceDriverSettlement,
  produceDriverSettlementsBatch,
} from "@/lib/services/driver-settlement-producer.service";
import {
  prepareQaSettlementRecovery,
  reviewQaSettlementRecovery,
} from "@/lib/qa-acceptance/settlement-recovery";
import {
  isQaFunctionalAcceptanceCurrent,
  recordQaFunctionalEvidence,
  reviewQaFunctionalEvidence,
} from "@/lib/production-readiness/qa-functional-evidence";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";
import { createDriver, seedVerifiedPaidOrderEvidence, uniqueTag } from "./phase7-5-fixtures";

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
    name: row.name ?? "Closeout Test User",
    role: row.role,
    status: row.status,
  };
}

describe("Bounded Engineering Closeout E01-E07 (Disposable PostgreSQL)", { timeout: 120_000 }, () => {
  const tag = uniqueTag("close").replace(/[^a-z0-9]/gi, "").slice(0, 14).toLowerCase();
  const settingKeysToClean: string[] = [];
  const createdProfileIds: string[] = [];
  const createdPlanIds: string[] = [];
  let previousActiveCompanyProfileIds: string[] = [];
  let pausedCourierPlanIds: string[] = [];
  let createdRegionId: string | null = null;
  let createdServiceId: string | null = null;
  let createdPolicyId: string | null = null;
  let qaRunId: string | null = null;

  let admin1!: AuthenticatedUser;
  let admin2!: AuthenticatedUser;
  let qaCustomer!: AuthenticatedUser;
  let kaventraOwner!: AuthenticatedUser;
  let liveStoreOwner!: AuthenticatedUser;
  let commercialCustomer!: AuthenticatedUser;
  let qaDriver!: Awaited<ReturnType<typeof createDriver>>;
  let commercialDriver!: Awaited<ReturnType<typeof createDriver>>;
  let qaStoreId!: string;
  let qaStoreSlug!: string;
  let liveStoreId!: string;
  let spaceBlackOfferRef!: string;
  let spaceBlackVariantRef!: string;
  let silverDraftOfferRef!: string;
  let liveOfferRef!: string;
  let categoryId!: string;
  let productTypeId!: string;

  const QA_TEST_SECRET = ["sk", "test", "closeout_isolated_secret_012345"].join("_");
  const RELEASE_SHA = "29480f652095ab6ce6d3ba5094dcffb7a8f30810";

  const mockRouteCalc = async () => ({
    ok: true as const,
    route: { distanceMeters: 6400, durationSeconds: 900, routeSummary: "6.4 km", provider: "e2e_deterministic" as const },
  });

  beforeEach(() => {
    vi.stubEnv("QA_ACCEPTANCE_LANE_ENABLED", "true");
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY", QA_TEST_SECRET);
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_PUBLIC_KEY", ["pk", "test", "closeout_isolated_public_012345"].join("_"));
    vi.stubEnv("PAYSTACK_SECRET_KEY", ["sk", "live", "closeout_must_never_be_called_00"].join("_"));
    vi.stubEnv("PAYSTACK_ACTIVE", "false");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.ktcouriers.com");
    vi.stubEnv("PAYMENT_APP_ORIGIN", "https://www.ktcouriers.com");
    vi.stubEnv("NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", RELEASE_SHA);
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

    // Pause any lingering active GLOBAL:COURIER_ORDER / QA:COURIER_ORDER plans during this suite and restore in afterAll.
    const activeCourierPlans = await prisma.commissionPlan.findMany({
      where: {
        subjectType: "COURIER_ORDER",
        scopeKey: { in: ["GLOBAL:COURIER_ORDER", "QA:COURIER_ORDER"] },
        status: "ACTIVE",
      },
      select: { id: true },
    });
    pausedCourierPlanIds = activeCourierPlans.map((p) => p.id);
    if (pausedCourierPlanIds.length) {
      await prisma.commissionPlan.updateMany({
        where: { id: { in: pausedCourierPlanIds } },
        data: { status: "RETIRED" },
      });
    }

    const existingActiveProfiles = await prisma.companyProfileVersion.findMany({
      where: { status: CompanyProfileVersionStatus.ACTIVE },
      select: { id: true },
    });
    previousActiveCompanyProfileIds = existingActiveProfiles.map((p) => p.id);

    const [a1, a2, qCust, oCust, kOwn, lOwn] = await Promise.all([
      prisma.user.create({
        data: { email: `${tag}-adm1@example.test`, name: "Closeout Super Admin", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { email: `${tag}-adm2@example.test`, name: "Closeout Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
      prisma.user.create({
        data: { email: `${tag}-qacust@example.test`, name: "QA Customer", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820001112" },
      }),
      prisma.user.create({
        data: { email: `${tag}-commcust@example.test`, name: "Commercial Customer", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820002223" },
      }),
      prisma.user.create({
        data: { email: `${tag}-kaventra@example.test`, name: "Kaventra Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820003334" },
      }),
      prisma.user.create({
        data: { email: `${tag}-livestore@example.test`, name: "Commercial Store Owner", role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phone: "+27820004445" },
      }),
    ]);

    admin1 = toAuthUser(a1);
    admin2 = toAuthUser(a2);
    qaCustomer = toAuthUser(qCust);
    commercialCustomer = toAuthUser(oCust);
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
        name: `Closeout Sandton ${tag}`,
        slug: `closeout-sandton-${tag}`,
        city: "Johannesburg",
        province: "Gauteng",
        coverageMode: "RADIUS",
        centerLat: "-26.1076000",
        centerLng: "28.0567000",
        coverageRadiusKm: "60.00",
        maxDistanceKm: "80.00",
        displayOrder: -60,
        active: true,
        pricingEnabled: true,
      },
    });
    createdRegionId = region.id;

    qaDriver = await createDriver(`${tag}-qadrv`, region.id, 3);
    commercialDriver = await createDriver(`${tag}-cmdrv`, region.id, 3);
    await prisma.driverProfile.updateMany({
      where: { id: { in: [qaDriver.profile.id, commercialDriver.profile.id] } },
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
            SMALL: { baseFee: "89.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
            MEDIUM: { baseFee: "140.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
            LARGE: { baseFee: "200.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
          },
          expectedVersion: latestStd?.versionNumber ?? 0,
          reason: "Closeout integration service definition",
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
          publicReference: `SOP-CL-${tag}`,
          name: `closeout-policy-${tag}`,
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
          content: `Closeout ${documentType}`,
        });
        await publishLegalDocumentVersion({
          actorUserId: admin1.id,
          publicReference: String(doc.publicReference),
          operationId: `${tag}-${documentType}-pub`,
          effectiveAt: new Date(Date.now() - 60_000),
        });
      }
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
        reason: "Closeout marketplace delivery matrix fixture",
        rules: [
          {
            key: `CL_GAUTENG_${tag.toUpperCase()}`,
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
        reason: "Independent approval for closeout delivery matrix",
      });
      const m2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: matrixKey } });
      await actOnDeliveryMatrix(admin2.id, {
        version: savedMatrix.version,
        expectedUpdatedAt: m2.updatedAt.toISOString(),
        action: "ACTIVATE",
        reason: "Activate closeout marketplace delivery matrix",
      });
    }

    // Create Kaventra QA store + Commercial store
    qaStoreSlug = `kaventra-closeout-${tag}`;
    const qaStore = await prisma.store.create({
      data: {
        ownerUserId: kaventraOwner.id,
        name: "Kaventra Tech Supply",
        slug: qaStoreSlug,
        status: "PENDING",
        contactEmail: kaventraOwner.email,
        contactPhone: "+27820003334",
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
        placeId: `place_kav_close_${tag}`,
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
      calculationVersion: `kav-close-${tag}`,
      rules: [{
        ruleCode: "KAVENTRA_8PCT",
        allocationType: "PLATFORM_COMMISSION_REVENUE",
        beneficiaryType: "PLATFORM",
        calculationMethod: "PERCENTAGE_BPS",
        rateBasisPoints: 800,
        priority: 1,
      }],
      actorUserId: admin1.id,
      operationId: randomUUID(),
    });
    await submitCommissionPlan(kavPlan.id, admin1.id, randomUUID());
    await approveCommissionPlan(kavPlan.id, admin2.id, randomUUID());
    await activateCommissionPlan(kavPlan.id, admin2.id, randomUUID());
    createdPlanIds.push(kavPlan.id);

    const liveStore = await prisma.store.create({
      data: {
        ownerUserId: liveStoreOwner.id,
        name: `Commercial Store ${tag}`,
        slug: `comm-store-${tag}`,
        status: "ACTIVE",
        contactEmail: liveStoreOwner.email,
        contactPhone: "+27820004445",
      },
    });
    liveStoreId = liveStore.id;
    const livePickup = await prisma.address.create({
      data: {
        storeId: liveStore.id,
        type: "PICKUP",
        isDefault: true,
        line1: "100 Main Road",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
        latitude: "-26.2041000",
        longitude: "28.0473000",
        placeId: `place_comm_${tag}`,
      },
    });
    await prisma.store.update({ where: { id: liveStore.id }, data: { defaultPickupAddressId: livePickup.id } });

    const cat = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `Closeout Tech ${tag}`,
        slug: `closeout-tech-${tag}`,
        path: `/closeout-tech-${tag}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    categoryId = cat.id;

    const pType = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `CL_TECH_${tag.toUpperCase()}`,
        name: `Closeout Hardware ${tag}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: { attributes: [] },
        variantSchema: {},
        complianceSchema: { requirements: [] },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });
    productTypeId = pType.id;
  });

  afterAll(async () => {
    if (qaRunId) {
      await updateQaAcceptanceRunLifecycle({
        actorUserId: admin1.id,
        runId: qaRunId,
        action: "ARCHIVE_AND_TEARDOWN",
        reason: "Closeout test cleanup",
      }).catch(() => {});
    }
    if (settingKeysToClean.length) {
      await prisma.systemSetting.deleteMany({ where: { key: { in: settingKeysToClean } } }).catch(() => {});
    }
    if (createdPlanIds.length) {
      await prisma.commissionPlan.updateMany({ where: { id: { in: createdPlanIds } }, data: { status: "RETIRED" } }).catch(() => {});
    }
    if (pausedCourierPlanIds.length) {
      await prisma.commissionPlan.updateMany({ where: { id: { in: pausedCourierPlanIds } }, data: { status: "ACTIVE" } }).catch(() => {});
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

  async function createOfferFixture(
    targetStoreId: string,
    ownerId: string,
    skuPrefix: string,
    options: { price: string; stock: number; publish: boolean },
  ) {
    const loc = await createStoreInventoryLocation(targetStoreId, ownerId, {
      name: `${skuPrefix} Hub ${tag}`,
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
        productTypeDefinitionId: productTypeId,
        primaryCategoryId: categoryId,
        title: `${skuPrefix} USB-C Hub`,
        description: "Multi-port dock for closeout verification.",
        condition: "NEW",
        attributeValues: {},
        complianceValues: {},
      },
      variants: [],
      storeSku: `${skuPrefix}-${tag}`,
      price: { amount: options.price, currency: "ZAR", priceIncludesTax: false, effectiveFrom: new Date(Date.now() - 60_000).toISOString() },
      openingStock: options.stock,
      inventoryLocationPublicReference: loc.publicReference,
      packaging: { lengthCm: 15, widthCm: 10, heightCm: 5, weightKg: 0.25, description: "Compact retail box" },
      modifiers: [],
      media: [{ assetPublicReference: media.asset.publicReference, altText: "Product", displayOrder: 0, primary: true, variantAssociation: "PRODUCT" }],
    });
    const offerRef = draft.offers[0]!.publicReference;
    const variantRef = draft.variants[0]!.publicReference;
    settingKeysToClean.push(`${PACKAGING_PREFIX}${offerRef}`);

    const offerRow = await prisma.storeCatalogOffer.findUniqueOrThrow({
      where: { publicReference: offerRef },
      select: { id: true, productId: true, version: true },
    });

    if (!options.publish) {
      return { offerRef, variantRef, offerId: offerRow.id, productId: offerRow.productId, version: offerRow.version };
    }

    const subP = await submitStoreCatalogProduct(targetStoreId, draft.publicReference, ownerId, { version: draft.version, operationId: randomUUID() });
    const appP = await moderateCatalogProduct(subP.id, admin1.id, "APPROVE", { version: subP.version, operationId: randomUUID(), reasonCode: "CLOSEOUT_APPROVAL" });
    const subO = await transitionStoreCatalogOffer(targetStoreId, offerRef, ownerId, "SUBMITTED", { version: offerRow.version, operationId: randomUUID() });
    const appO = await moderateCatalogOffer(subO.id, admin1.id, "APPROVE", { version: subO.version, operationId: randomUUID(), reasonCode: "CLOSEOUT_OFFER_APPROVAL" });
    const pub = await publishApprovedCatalogListing(appO.id, admin2.id, {
      version: appO.version,
      productVersion: appP.version,
      priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
      operationId: randomUUID(),
      reasonCode: "CLOSEOUT_PUBLICATION",
    });

    return { offerRef, variantRef, offerId: offerRow.id, productId: offerRow.productId, version: pub.offer.version };
  }

  it("covers E01-E03: dynamic hours preflight, onboarding fix, v1/v2 packaging mismatch diagnostics, QA-only synthetic packaging, storefront projection rebuild, and stock decrement/restore", async () => {
    // Enroll QA principals & start active run
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: qaCustomer.id, role: "CUSTOMER", label: "Closeout Customer" });
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: kaventraOwner.id, role: "VENDOR", storeIdentifier: qaStoreId, label: "Kaventra" });
    await enrollQaAcceptancePrincipal({ actorUserId: admin1.id, userIdentifier: qaDriver.user.id, role: "DRIVER", label: "Closeout Driver" });
    const run = await startQaAcceptanceRun({
      actorUserId: admin1.id,
      title: `Closeout Run ${tag}`,
      storeId: qaStoreId,
      customerUserId: qaCustomer.id,
      driverProfileId: qaDriver.profile.id,
    });
    qaRunId = run.id;

    // Save operating hours via real service & activate store
    await updateStoreProfile(kaventraOwner.id, { operatingHours: DEFAULT_STORE_OPERATING_HOURS });
    await setStoreStatus(qaStoreId, "ACTIVE", { actorUserId: admin1.id, reason: "Activate Kaventra QA store" });

    // E01: Dynamic pickup preflight reflects CONFIGURED hours without false TRADING_HOURS_NOT_CONFIRMED
    const pickupPreflight = await getStorePickupOperationalPreflight(qaStoreId);
    expect(pickupPreflight?.operatingHoursState.status).toBe("CONFIGURED");
    expect(pickupPreflight?.operatingHoursState.physicalSiteConfirmed).toBe(false);
    expect(pickupPreflight?.outstandingChecks).not.toContain("TRADING_HOURS_NOT_CONFIRMED");

    // Seed Space Black (published) & Silver (DRAFT), plus live control offer
    const spaceBlack = await createOfferFixture(qaStoreId, kaventraOwner.id, "SPACEBLACK", { price: "149.00", stock: 30, publish: true });
    spaceBlackOfferRef = spaceBlack.offerRef;
    spaceBlackVariantRef = spaceBlack.variantRef;
    const silverDraft = await createOfferFixture(qaStoreId, kaventraOwner.id, "SILVER", { price: "149.00", stock: 10, publish: false });
    silverDraftOfferRef = silverDraft.offerRef;
    const liveProd = await createOfferFixture(liveStoreId, liveStoreOwner.id, "COMM", { price: "199.00", stock: 15, publish: true });
    liveOfferRef = liveProd.offerRef;

    // E01: Store onboarding projection recognizes first_product stage cleanly
    const onboarding = await getStoreOnboardingByStoreId(qaStoreId);
    expect(onboarding).not.toBeNull();
    expect(onboarding?.stages.some((s) => s.id === "first_product")).toBe(true);

    // Reproduce trusted package v1 binding when Space Black offer advances to v2!
    const pkgSettingV1 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: `${PACKAGING_PREFIX}${spaceBlackOfferRef}` } });
    const rev1 = (pkgSettingV1.value as { revision: string }).revision;
    const latestV0 = Math.max(0, ...(await listTrustedPackageVersionsSafely()).versions.map((v) => v.version));
    const draftV1 = await saveTrustedPackageVersion(admin1.id, {
      expectedVersion: latestV0,
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      effectiveTo: null,
      packages: [{
        storeId: qaStoreId,
        offerReference: spaceBlackOfferRef,
        variantReference: spaceBlackVariantRef,
        publicationVersion: String(spaceBlack.version),
        modifiers: [],
        packingRule: "SINGLE_PREPACKAGED_UNIT",
        lengthCm: 15,
        widthCm: 10,
        heightCm: 5,
        weightKg: 0.25,
        authorityReference: `${PACKAGING_PREFIX}${spaceBlackOfferRef}:${rev1}`,
      }],
      bundles: [],
      reason: "Bind Space Black v1 prior to edit bump",
    });
    settingKeysToClean.push(`production_marketplace_trusted_packages_v${draftV1.version}`);
    const rowV1a = await prisma.systemSetting.findUniqueOrThrow({ where: { key: `production_marketplace_trusted_packages_v${draftV1.version}` } });
    await actOnTrustedPackageVersion(admin2.id, { version: draftV1.version, expectedUpdatedAt: rowV1a.updatedAt.toISOString(), action: "APPROVE", reason: "Approve v1 package" });
    const rowV1b = await prisma.systemSetting.findUniqueOrThrow({ where: { key: `production_marketplace_trusted_packages_v${draftV1.version}` } });
    await actOnTrustedPackageVersion(admin2.id, { version: draftV1.version, expectedUpdatedAt: rowV1b.updatedAt.toISOString(), action: "ACTIVATE", reason: "Activate v1 package" });

    // Pause -> edit -> resume Space Black offer (bumps offer.version 1 -> 4), reproducing exact PUBLICATION_VERSION_MISMATCH!
    const pausedSb = await transitionStoreCatalogOffer(qaStoreId, spaceBlackOfferRef, kaventraOwner.id, "PAUSED", {
      version: spaceBlack.version,
      operationId: randomUUID(),
    });
    const updatedSb = await updateStoreCatalogOffer(qaStoreId, spaceBlackOfferRef, kaventraOwner.id, {
      version: pausedSb.version,
      merchantTitle: "Space Black USB-C Hub (Updated)",
      operationId: randomUUID(),
    });
    const resumedSb = await transitionStoreCatalogOffer(qaStoreId, spaceBlackOfferRef, kaventraOwner.id, "ACTIVE", {
      version: updatedSb.version,
      operationId: randomUUID(),
    });

    const diagBefore = await diagnoseStoreOffersSellability(qaStoreId);
    const sbDiagBefore = diagBefore?.offers.find((o) => o.offerReference === spaceBlackOfferRef);
    const silverDiagBefore = diagBefore?.offers.find((o) => o.offerReference === silverDraftOfferRef);
    expect(sbDiagBefore?.offerVersion).toBe(resumedSb.version);
    expect(resumedSb.version).toBeGreaterThan(1);
    expect(sbDiagBefore?.sellableForCheckout).toBe(false);
    expect(sbDiagBefore?.failedReasonCodes).toContain("TRUSTED_PACKAGE_PUBLICATION_VERSION_MISMATCH");
    expect(silverDiagBefore?.failedReasonCodes).toContain("OFFER_NOT_ACTIVE_OR_UNPUBLISHED");

    // E02: Record QA synthetic packaging (15x10x5 cm, 0.25 kg) with dual control; commercial isolation MUST reject QA package on commercial store
    await expect(
      recordQaSyntheticPackageDraft({
        actorUserId: admin1.id,
        runId: qaRunId,
        storeId: liveStoreId,
        offerReference: liveOfferRef,
        lengthCm: 15,
        widthCm: 10,
        heightCm: 5,
        weightKg: 0.25,
        reason: "Must reject commercial store",
      }),
    ).rejects.toMatchObject({ code: "QA_ISOLATION_VIOLATION" });

    const qaPkgDraft = await recordQaSyntheticPackageDraft({
      actorUserId: admin1.id,
      runId: qaRunId,
      storeId: qaStoreId,
      offerReference: spaceBlackOfferRef,
      lengthCm: 15,
      widthCm: 10,
      heightCm: 5,
      weightKg: 0.25,
      reason: "Bind Kaventra Space Black v2 for QA checkout",
    });
    settingKeysToClean.push(`production_marketplace_trusted_packages_v${qaPkgDraft.version}`);
    // Self-approval fails
    await expect(
      reviewAndActivateQaSyntheticPackaging({
        actorUserId: admin1.id,
        version: qaPkgDraft.version,
        expectedUpdatedAt: qaPkgDraft.updatedAt,
        action: "APPROVE",
        reason: "Self approval must fail",
      }),
    ).rejects.toThrow();

    const approvedPkg = await reviewAndActivateQaSyntheticPackaging({
      actorUserId: admin2.id,
      version: qaPkgDraft.version,
      expectedUpdatedAt: qaPkgDraft.updatedAt,
      action: "APPROVE",
      reason: "Independent approval of QA synthetic packaging",
    });
    const activatedPkg = await reviewAndActivateQaSyntheticPackaging({
      actorUserId: admin2.id,
      version: approvedPkg.version,
      expectedUpdatedAt: approvedPkg.updatedAt,
      action: "ACTIVATE",
      reason: "Activate QA synthetic packaging",
    });
    expect(activatedPkg.status).toBe("ACTIVE");

    const diagAfter = await diagnoseStoreOffersSellability(qaStoreId);
    const sbDiagAfter = diagAfter?.offers.find((o) => o.offerReference === spaceBlackOfferRef);
    expect(sbDiagAfter?.sellableForCheckout).toBe(true);
    expect(sbDiagAfter?.packaging.trustedPackageMatched).toBe(true);
    expect(sbDiagAfter?.packaging.isQaSyntheticAuthority).toBe(true);

    // E03: Withdraw StorefrontProductDocument intentionally before cert approval -> approval rebuilds /shop/qa projection atomically!
    await prisma.storefrontProductDocument.updateMany({
      where: { storeId: qaStoreId },
      data: { status: "WITHDRAWN", searchable: false },
    });

    const preflight = await evaluateStoreCheckoutCapabilityPreflight(qaStoreId, { routeCalculator: mockRouteCalc });
    expect(preflight?.preflightReady).toBe(true);
    const certDraft = await prepareStoreCheckoutCertificationFromPreflight(qaStoreId, admin1.id, "Closeout E03 cert", {
      routeCalculator: mockRouteCalc,
    });
    const certApproved = await approveStoreCheckoutCertification(qaStoreId, admin2.id, certDraft.revision, {
      routeCalculator: mockRouteCalc,
    });
    expect(certApproved.status).toBe("APPROVED");

    const qaVisibleStores = await listQaStorefrontStores([qaStoreId]);
    expect(qaVisibleStores.some((s) => s.slug === qaStoreSlug)).toBe(true);
    const qaStoreDetail = await getQaStorefrontStore(qaStoreSlug, [qaStoreId]);
    expect(qaStoreDetail?.products.length).toBeGreaterThanOrEqual(1);
    const publicStores = await listStorefrontStores({ limit: 50 });
    expect(publicStores.some((s) => s.slug === qaStoreSlug)).toBe(false);

    // E02: Checkout #1 cancel releases reservation cleanly (30 -> 29 -> 30)
    const cartRepo = createPrismaMarketplaceCartRepository();
    const custOwner = { type: "CUSTOMER" as const, userId: qaCustomer.id };
    const sbSel = await resolveMarketplaceCartLine(
      { offerReference: spaceBlackOfferRef, variantReference: spaceBlackVariantRef, quantity: 1, modifiers: [] },
      undefined,
      { qaUserId: qaCustomer.id },
    );
    let cart = await createOrResolveCart(cartRepo, custOwner, () => cartRepo.create(custOwner));
    cart = (await addCartLine(cartRepo, {
      cartId: cart.id,
      owner: custOwner,
      mutation: { operationId: `${tag}:cart1`, requestHash: reqHash(`${tag}:cart1`), expectedVersion: cart.version },
      selection: sbSel,
    })).cart;

    const chk1 = await createMarketplaceCheckout({ cartReference: cart.publicReference, owner: custOwner });
    const chk1Row = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: chk1.id } });
    const c1Contact = await updateMarketplaceCheckoutContact({
      reference: chk1.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:c1-contact`, requestHash: reqHash(`${tag}:c1-contact`), expectedVersion: chk1Row.version },
      contact: { recipientName: "QA Buyer", email: qaCustomer.email, phone: "+27820001112", preferredContactMethod: "EMAIL" },
    });
    const c1Addr = await updateMarketplaceCheckoutAddress({
      reference: chk1.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:c1-addr`, requestHash: reqHash(`${tag}:c1-addr`), expectedVersion: c1Contact.version },
      address: { recipientName: "QA Buyer", line1: "45 Commissioner Street", suburb: "Marshalltown", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
    });
    await executeMarketplaceDeliveryQuotes({ reference: chk1.publicReference, owner: custOwner, expectedVersion: c1Addr.version });
    const c1Rev = await executeMarketplaceCheckoutReview({
      reference: chk1.publicReference,
      owner: custOwner,
      operationId: `${tag}:c1-rev`,
      requestHash: reqHash(`${tag}:c1-rev`),
      expectedVersion: c1Addr.version,
    });
    const c1PostRev = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: chk1.id }, select: { version: true } });
    const legal = await resolveMarketplaceLegalEvidence();
    const c1Ack = await executeMarketplaceCheckoutAcknowledgement({
      reference: chk1.publicReference,
      owner: custOwner,
      operationId: `${tag}:c1-ack`,
      requestHash: reqHash(`${tag}:c1-ack`),
      expectedVersion: c1PostRev.version,
      reviewVersion: c1Rev.reviewVersion,
      commercialFingerprint: c1Rev.commercialFingerprint,
      acknowledgedTotalReference: c1Rev.grandTotal,
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
      refundPolicyReferences: [...legal.refundPolicyReferences],
    });
    await beginMarketplaceReservation({
      reference: chk1.publicReference,
      owner: custOwner,
      expectedVersion: c1Ack.checkoutVersion,
      operationId: `${tag}:c1-res`,
      requestHash: reqHash(`${tag}:c1-res`),
    });

    const invReserved = await prisma.catalogInventoryLevel.findFirstOrThrow({
      where: { inventoryItem: { offer: { publicReference: spaceBlackOfferRef } } },
    });
    expect(invReserved.available).toBe(29);
    expect(invReserved.onHand).toBe(30);

    await cancelMarketplaceCheckout({
      reference: chk1.publicReference,
      owner: custOwner,
      operationId: `${tag}:c1-cancel`,
    });
    const invRestored = await prisma.catalogInventoryLevel.findFirstOrThrow({
      where: { inventoryItem: { offer: { publicReference: spaceBlackOfferRef } } },
    });
    expect(invRestored.available).toBe(30);
    expect(invRestored.onHand).toBe(30);

    // Checkout #2 paid finalization decrements both available & onHand (30 -> 29)
    let cart2 = await createOrResolveCart(cartRepo, custOwner, () => cartRepo.create(custOwner));
    cart2 = (await addCartLine(cartRepo, {
      cartId: cart2.id,
      owner: custOwner,
      mutation: { operationId: `${tag}:cart2`, requestHash: reqHash(`${tag}:cart2`), expectedVersion: cart2.version },
      selection: sbSel,
    })).cart;
    const chk2 = await createMarketplaceCheckout({ cartReference: cart2.publicReference, owner: custOwner });
    const chk2Row = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: chk2.id } });
    const c2Contact = await updateMarketplaceCheckoutContact({
      reference: chk2.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:c2-contact`, requestHash: reqHash(`${tag}:c2-contact`), expectedVersion: chk2Row.version },
      contact: { recipientName: "QA Buyer", email: qaCustomer.email, phone: "+27820001112", preferredContactMethod: "EMAIL" },
    });
    const c2Addr = await updateMarketplaceCheckoutAddress({
      reference: chk2.publicReference,
      owner: custOwner,
      operation: { operationId: `${tag}:c2-addr`, requestHash: reqHash(`${tag}:c2-addr`), expectedVersion: c2Contact.version },
      address: { recipientName: "QA Buyer", line1: "45 Commissioner Street", suburb: "Marshalltown", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
    });
    await executeMarketplaceDeliveryQuotes({ reference: chk2.publicReference, owner: custOwner, expectedVersion: c2Addr.version });
    const c2Rev = await executeMarketplaceCheckoutReview({
      reference: chk2.publicReference,
      owner: custOwner,
      operationId: `${tag}:c2-rev`,
      requestHash: reqHash(`${tag}:c2-rev`),
      expectedVersion: c2Addr.version,
    });
    const c2PostRev = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: chk2.id }, select: { version: true } });
    const c2Ack = await executeMarketplaceCheckoutAcknowledgement({
      reference: chk2.publicReference,
      owner: custOwner,
      operationId: `${tag}:c2-ack`,
      requestHash: reqHash(`${tag}:c2-ack`),
      expectedVersion: c2PostRev.version,
      reviewVersion: c2Rev.reviewVersion,
      commercialFingerprint: c2Rev.commercialFingerprint,
      acknowledgedTotalReference: c2Rev.grandTotal,
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
      refundPolicyReferences: [...legal.refundPolicyReferences],
    });
    await beginMarketplaceReservation({
      reference: chk2.publicReference,
      owner: custOwner,
      expectedVersion: c2Ack.checkoutVersion,
      operationId: `${tag}:c2-res`,
      requestHash: reqHash(`${tag}:c2-res`),
    });
    const c2PostRes = await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: chk2.id }, select: { version: true } });

    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { reference: string };
      return new Response(
        JSON.stringify({
          status: true,
          message: "OK",
          data: { authorization_url: `https://checkout.paystack.com/${payload.reference}`, access_code: `ac_${payload.reference}`, reference: payload.reference },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }));
    const prepPay = await prepareMarketplacePayment({
      reference: chk2.publicReference,
      owner: custOwner,
      expectedVersion: c2PostRes.version,
      operationId: `${tag}:c2-pay`,
      requestHash: reqHash(`${tag}:c2-pay`),
    });
    const pRow = await prisma.payment.findUniqueOrThrow({ where: { publicReference: prepPay.paymentReference }, include: { attempts: true } });
    await recoverPaystackAttemptViaVerify({
      attemptId: pRow.attempts[0]!.id,
      trigger: "closeout_e02_verify",
      clientOverride: {
        verifyTransaction: vi.fn().mockResolvedValue({
          id: randomInt(100_000, 999_999),
          status: "success",
          reference: pRow.attempts[0]!.merchantReference,
          amount: Math.round(Number(prepPay.amount) * 100),
          currency: "ZAR",
        }),
      } as never,
    });

    const invPaid = await prisma.catalogInventoryLevel.findFirstOrThrow({
      where: { inventoryItem: { offer: { publicReference: spaceBlackOfferRef } } },
    });
    expect(invPaid.available).toBe(29);
    expect(invPaid.onHand).toBe(29);
  });

  async function executeCompleteQaCourierDelivery(label: string) {
    const quote = await createPublicQuote({
      serviceKey: "CLIENT_STANDARD",
      parcelSize: "SMALL",
      weightKg: "1.0",
      pickupAddress: { line1: "22 Sandton Drive", suburb: "Sandton", city: "Sandton", province: "Gauteng", postalCode: "2196" },
      dropoffAddress: { line1: "45 Commissioner Street", suburb: "Marshalltown", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
    });
    const quoteRow = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } });
    const bookingInput = (quoteRow.metadata as { bookingInput: Record<string, unknown> }).bookingInput;
    const orderDto = await prisma.$transaction(async (tx) => {
      await tx.pricingQuote.update({ where: { id: quote.id }, data: { ownerId: qaCustomer.id, ownerType: "CUSTOMER", storeId: null } });
      return createOrder(
        qaCustomer,
        {
          deliveryType: bookingInput.deliveryType as DeliveryType,
          pickupAddress: bookingInput.pickupAddress as Parameters<typeof createOrder>[1]["pickupAddress"],
          dropoffAddress: bookingInput.dropoffAddress as Parameters<typeof createOrder>[1]["dropoffAddress"],
          actualWeightKg: String(bookingInput.actualWeightKg ?? "1.0"),
          pricingQuoteId: quote.id,
          recipientName: "QA Recipient",
          recipientPhone: "+27825550999",
          recipientEmail: qaCustomer.email,
          parcelDescription: `Closeout parcel ${label}`,
          parcelCount: 1,
          paymentMethod: "DIGITAL_ONLY",
        },
        false,
        tx,
        undefined,
        { isQaAcceptance: true, qaAcceptanceRunId: qaRunId! },
      );
    });

    const payPrep = await prepareOrderPayment(qaCustomer, { orderId: orderDto.id, idempotencyKey: `${tag}:${label}-prep` });
    const payRow = await prisma.payment.findUniqueOrThrow({ where: { publicReference: payPrep.publicReference } });
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { reference: string };
      return new Response(
        JSON.stringify({
          status: true,
          message: "OK",
          data: { authorization_url: `https://checkout.paystack.com/${payload.reference}`, access_code: `ac_${payload.reference}`, reference: payload.reference },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }));
    const sess = await createProviderCheckoutSession({ id: qaCustomer.id }, { paymentId: payRow.id, provider: "PAYSTACK", idempotencyKey: `${tag}:${label}-sess` });
    await recoverPaystackAttemptViaVerify({
      attemptId: sess.attempt.id,
      trigger: `closeout_${label}`,
      clientOverride: {
        verifyTransaction: vi.fn().mockResolvedValue({
          id: randomInt(100_000, 999_999),
          status: "success",
          reference: sess.attempt.merchantReference,
          amount: Math.round(Number(payPrep.amount) * 100),
          currency: "ZAR",
        }),
      } as never,
    });

    const offer = await offerAssignment(admin1.id, orderDto.id, { driverProfileId: qaDriver.profile.id, reasonCode: `QA_${label.toUpperCase()}` });
    await acceptDispatchAssignment(qaDriver.profile.id, offer.id, { expectedVersion: offer.version });
    await prisma.$transaction(async (tx) => {
      await transitionOrderStatusInTx(tx, {
        orderId: orderDto.id,
        fromStatus: OrderStatus.PICKUP_SCHEDULED,
        toStatus: OrderStatus.PICKED_UP,
        actorUserId: qaDriver.user.id,
        actorRole: "DRIVER",
        source: `qa_${label}_pickup`,
        context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true, hasPickupProof: true },
      });
      await transitionOrderStatusInTx(tx, {
        orderId: orderDto.id,
        fromStatus: OrderStatus.PICKED_UP,
        toStatus: OrderStatus.IN_TRANSIT,
        actorUserId: qaDriver.user.id,
        actorRole: "DRIVER",
        source: `qa_${label}_transit`,
        context: { actorIsAssignedDriver: true, hasAcceptedAssignment: true },
      });
    });
    const afterAccept = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } });
    await recordQaSimulatedDriverLocation(offer.id, qaDriver.profile.id, qaDriver.user.id, {
      operationId: randomUUID(),
      assignmentVersion: afterAccept.version,
      mode: "QA_SIMULATED",
    });
    await recordDriverDeliveryResponsibility({ assignmentId: offer.id, driverProfileId: qaDriver.profile.id, driverUserId: qaDriver.user.id, assignmentVersion: afterAccept.version, reportType: "SAFETY_CHECK", operationId: randomUUID() });
    await recordDriverDeliveryResponsibility({ assignmentId: offer.id, driverProfileId: qaDriver.profile.id, driverUserId: qaDriver.user.id, assignmentVersion: afterAccept.version, reportType: "LAWFUL_TRANSPORT_CONFIRMATION", operationId: randomUUID() });
    const otp = await generateAndSendDeliveryOtp(offer.id, qaDriver.profile.id, qaDriver.user.id, { operationId: randomUUID(), assignmentVersion: afterAccept.version, stage: "DELIVERY" });
    if (!otp.ok) throw new Error(otp.error);
    const completedRes = await completeDelivery(offer.id, qaDriver.profile.id, qaDriver.user.id, {
      operationId: randomUUID(),
      assignmentVersion: afterAccept.version,
      otpCode: getTestIssuedDeliveryOtp(otp.otpId),
      recipientName: "QA Recipient",
      recipientPhone: "+27825550999",
      publicNote: "Delivered",
      driverNote: label,
      confirmDelivery: true,
    });
    if (!completedRes.ok) throw new Error(completedRes.error);
    const completedAssign = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } });
    return { orderId: orderDto.id, orderNumber: orderDto.orderNumber, assignmentId: offer.id, completedAt: completedAssign.completedAt! };
  }

  it("covers E04, E05 & E07: historical QA settlement recovery without timestamp forgery, QA:COURIER_ORDER future scoping, reconciliation, QA_FUNCTIONAL checks & commercial isolation", async () => {
    const baselineFinance = await getFinanceDashboard();

    // Two historical QA orders completed BEFORE any GLOBAL/QA courier plan exists!
    const hist1 = await executeCompleteQaCourierDelivery("hist1");
    const hist2 = await executeCompleteQaCourierDelivery("hist2");

    // Also create a completed commercial order without any historical GLOBAL:COURIER_ORDER plan
    const commOrder = await prisma.order.create({
      data: {
        orderNumber: `KT-COMM-${tag.toUpperCase()}`,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.DELIVERED,
        deliveryType: DeliveryType.SAME_DAY,
        currency: "ZAR",
        customerId: commercialCustomer.id,
        priceEstimate: "110.00",
        isQaAcceptance: false,
      },
    });
    await seedVerifiedPaidOrderEvidence(prisma, { orderId: commOrder.id, amount: "110.00", customerId: commercialCustomer.id, tag: `${tag}-comm` });
    const commAssign = await prisma.orderAssignment.create({
      data: {
        orderId: commOrder.id,
        driverProfileId: commercialDriver.profile.id,
        status: "COMPLETED",
        assignedByAdminId: admin1.id,
        assignedAt: new Date(Date.now() - 120_000),
        acceptedAt: new Date(Date.now() - 90_000),
        completedAt: new Date(Date.now() - 30_000),
        version: 2,
      },
    });
    await prisma.proofOfDelivery.create({
      data: {
        orderId: commOrder.id,
        assignmentId: commAssign.id,
        driverProfileId: commercialDriver.profile.id,
        method: "ADMIN_MANUAL",
        recipientName: "Comm Recipient",
        deliveredAt: commAssign.completedAt!,
        createdByUserId: admin1.id,
        createdByRole: "SUPER_ADMIN",
      },
    });
    settingKeysToClean.push(`qa_settlement_recovery:${hist1.orderId}`, `qa_settlement_recovery:${hist2.orderId}`);

    // Now create & activate QA:COURIER_ORDER plan AFTER historical completions!
    const qaPlanDraft = await createCommissionPlan({
      subjectType: "COURIER_ORDER",
      scopeKey: "QA:COURIER_ORDER",
      basisType: "ORDER_TOTAL",
      effectiveFrom: new Date(Date.now() + 500).toISOString(),
      calculationVersion: `qa-courier-${tag}`,
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
    await submitCommissionPlan(qaPlanDraft.id, admin1.id, randomUUID());
    await approveCommissionPlan(qaPlanDraft.id, admin2.id, randomUUID());
    const activeQaPlan = await activateCommissionPlan(qaPlanDraft.id, admin2.id, randomUUID());
    createdPlanIds.push(activeQaPlan.id);
    const originalPlanApprovedAt = activeQaPlan.approvedAt!;

    // E04: Historical QA orders are explicitly diagnosed as blocked before recovery
    const diag1 = await diagnoseDriverSettlementReadiness(hist1.orderId);
    expect(diag1?.settled).toBe(false);
    expect(diag1?.blockerCode).toBe("COURIER_COMMISSION_PLAN_NOT_EFFECTIVE_AT_COMPLETION");
    const dryRun = await produceDriverSettlementsBatch({ mode: "DRY_RUN", limit: 100 });
    expect(dryRun.results.some((r) => r.orderId === hist1.orderId && r.outcome === "BLOCKED")).toBe(true);

    // Commercial orders are STRICTLY rejected from QA settlement recovery
    await expect(
      prepareQaSettlementRecovery({
        actorUserId: admin1.id,
        orderId: commOrder.id,
        planPublicReference: activeQaPlan.publicReference,
        reason: "Commercial orders must never bypass global historical plan checks",
      }),
    ).rejects.toMatchObject({ code: "QA_RECOVERY_ISOLATION_VIOLATION" });
    await expect(produceDriverSettlement(commOrder.id)).rejects.toThrow();

    // Prepare & independently approve QA settlement recovery on hist1 & hist2
    for (const h of [hist1, hist2]) {
      const prepared = await prepareQaSettlementRecovery({
        actorUserId: admin1.id,
        orderId: h.orderId,
        planPublicReference: activeQaPlan.publicReference,
        reason: `Dual-approved QA historical recovery for ${h.orderNumber}`,
      });
      expect(prepared.status).toBe("PENDING_REVIEW");

      // Self-approval fails
      await expect(
        reviewQaSettlementRecovery({
          actorUserId: admin1.id,
          orderId: h.orderId,
          expectedVersion: prepared.version,
          action: "APPROVE",
          reason: "Same admin self-approval must fail",
        }),
      ).rejects.toMatchObject({ code: "QA_RECOVERY_INDEPENDENT_REVIEW_REQUIRED" });

      const approved = await reviewQaSettlementRecovery({
        actorUserId: admin2.id,
        orderId: h.orderId,
        expectedVersion: prepared.version,
        action: "APPROVE",
        reason: `Second admin approves QA recovery for ${h.orderNumber}`,
        settleImmediately: true,
      });
      expect(approved.recovery.status).toBe("CONSUMED");
      expect(approved.settlement?.settlementVersion).toBe("courier-fulfilment-v1:qa-recovery");
    }

    // Assert NO timestamp backdating occurred!
    const refreshedPlan = await prisma.commissionPlan.findUniqueOrThrow({ where: { id: activeQaPlan.id } });
    expect(refreshedPlan.approvedAt?.toISOString()).toBe(new Date(originalPlanApprovedAt).toISOString());
    const refreshedAssign1 = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: hist1.assignmentId } });
    expect(refreshedAssign1.completedAt?.toISOString()).toBe(hist1.completedAt.toISOString());

    // Future QA courier delivery settles automatically via QA:COURIER_ORDER without recovery
    await new Promise((r) => setTimeout(r, 700));
    const futureQa = await executeCompleteQaCourierDelivery("future1");
    const futureSettled = await produceDriverSettlement(futureQa.orderId);
    expect(futureSettled.settlementVersion).toBe("courier-fulfilment-v1");

    // Verify commercial finance dashboard & E07 readiness scope stay untouched by QA plans/earnings
    const afterFinance = await getFinanceDashboard();
    expect(afterFinance.commissions.accrued).toBe(baselineFinance.commissions.accrued);
    expect(afterFinance.driverEarnings.totalAccrued).toBe(baselineFinance.driverEarnings.totalAccrued);

    const dashboard = await getQaAcceptanceDashboard();
    expect(dashboard.reconciliation.qaOrders.some((o) => o.orderNumber === hist1.orderNumber && o.settled)).toBe(true);
    expect(dashboard.reconciliation.qaOrders.some((o) => o.orderNumber === futureQa.orderNumber && o.settled)).toBe(true);
    expect(dashboard.reconciliation.runBreakdowns.some((r) => r.runId === qaRunId && r.courierOrdersCount >= 3)).toBe(true);

    // E05: Server-verified QA_FUNCTIONAL evidence works separately & stays commercialLiveEquivalent: false
    const runRow = await prisma.qaAcceptanceRun.findUniqueOrThrow({ where: { id: qaRunId! } });
    settingKeysToClean.push("production_qa_functional_qa_vendor_onboarding_workflow", "production_qa_functional_qa_isolated_settlement_workflow");
    const qaFuncDraft = await recordQaFunctionalEvidence(admin1.id, {
      key: "qa_isolated_settlement_workflow",
      releaseSha: RELEASE_SHA,
      qaRunReference: runRow.publicReference,
      evidenceReference: `qa-func:${tag}`,
      orderNumber: hist1.orderNumber,
      reason: "Server-verified isolated QA driver settlement closeout check",
      expectedVersion: 0,
    });
    expect(qaFuncDraft.commercialLiveEquivalent).toBe(false);
    expect(qaFuncDraft.verificationMode).toBe("SERVER_VERIFIED");

    await expect(
      reviewQaFunctionalEvidence(admin1.id, {
        key: "qa_isolated_settlement_workflow",
        expectedVersion: qaFuncDraft.version,
        action: "APPROVE",
        reason: "Self approval must fail",
      }),
    ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEW_REQUIRED" });

    const qaFuncApproved = await reviewQaFunctionalEvidence(admin2.id, {
      key: "qa_isolated_settlement_workflow",
      expectedVersion: qaFuncDraft.version,
      action: "APPROVE",
      reason: "Second admin approves QA functional acceptance check",
    });
    expect(isQaFunctionalAcceptanceCurrent(qaFuncApproved, RELEASE_SHA)).toBe(true);

    // Commercial capability `approved_commission_plan` MUST still ignore QA:COURIER_ORDER plan (E07)
    const prodReadiness = await getProductionReadiness();
    const commCap = prodReadiness.capabilities.find((c) => c.key === "approved_commission_plan");
    expect(commCap?.status).not.toBe("READY");
    expect(prodReadiness.qaFunctionalAcceptance.some((r) => r.key === "qa_isolated_settlement_workflow")).toBe(true);
  });
});
