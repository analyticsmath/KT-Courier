import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async () => ({
      latitude: -26.1076,
      longitude: 28.0567,
    })),
    reverseGeocodeSouthAfricanProvince: vi.fn(async () => "Gauteng" as const),
  };
});

import { prisma } from "@/lib/db/prisma";
import { isSafeLocalTestDatabaseUrl } from "@/lib/testing/safe-postgres-validator";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import {
  activateCommissionPlan,
  approveCommissionPlan,
  createCommissionPlan,
  submitCommissionPlan,
} from "@/lib/services/commission-plan.service";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import {
  moderateCatalogOffer,
  moderateCatalogProduct,
} from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import {
  CatalogMediaIntakeService,
  PrismaCatalogMediaRepository,
} from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersions,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import {
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  pickupCertificationFingerprint,
  prepareStoreCheckoutCertificationFromPreflight,
  revalidateStoreCheckoutCertification,
  type CheckoutCapabilityPreflightOptions,
} from "@/lib/admin/store-checkout-certification.service";
import { runDisposableStoreCheckoutEngineProof } from "@/lib/admin/store-checkout-engine-proof.service";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";
import { resolveVerifiedStorePickupCoordinates } from "@/lib/marketplace-checkout/verified-store-pickup-coordinates";
import { isMerchantPickupEvidenceComplete } from "@/lib/store-presentation/merchant-pickup-evidence";
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";
import {
  getStorefrontProduct,
  getStorefrontStore,
  listStorefrontStores,
} from "@/lib/services/storefront-catalog.service";
import {
  loadStorefrontDocuments,
  PostgresStorefrontSearchAdapter,
} from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";

const preflightOpts: CheckoutCapabilityPreflightOptions = {
  routeCalculator: async () => ({
    ok: true as const,
    route: {
      distanceMeters: 4200,
      durationSeconds: 780,
      routeSummary: "4.2 km · ~13 min",
      provider: "e2e_deterministic" as const,
    },
  }),
  paymentProviderReadiness: [
    {
      code: "PAYSTACK",
      configured: true,
      active: true,
      environment: "sandbox",
      errorCategory: "NONE",
    },
  ],
};

type CreatedScenario = Readonly<{
  label: string;
  ownerId: string;
  admin1Id: string;
  admin2Id: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  pickupId: string;
  regionId: string;
  serviceId: string;
  commissionPlanId: string;
  productRef: string;
  offerRef: string;
  priceVersionRef: string;
  trustedPackageVersion: number;
}>;

const cleanupSettingKeys: string[] = [];
const cleanupCommissionPlanIds: string[] = [];
const cleanupServiceIds: string[] = [];
const cleanupRegionIds: string[] = [];
const createdPolicyIds: string[] = [];

async function ensureParcelProfilesExist(adminUserId: string) {
  const specs = [
    { stableKey: "SMALL", displayName: "Small Parcel", l: 30, w: 20, h: 10, kg: 5 },
    { stableKey: "MEDIUM", displayName: "Medium Parcel", l: 45, w: 35, h: 25, kg: 15 },
    { stableKey: "LARGE", displayName: "Large Parcel", l: 70, w: 50, h: 40, kg: 30 },
  ] as const;
  for (const spec of specs) {
    const existing = await prisma.parcelProfileVersion.findFirst({
      where: { stableKey: spec.stableKey, status: "ACTIVE" },
    });
    if (!existing) {
      await prisma.parcelProfileVersion.create({
        data: {
          stableKey: spec.stableKey,
          displayName: spec.displayName,
          versionNumber: 1,
          status: "ACTIVE",
          lengthCm: spec.l,
          widthCm: spec.w,
          heightCm: spec.h,
          maximumWeightKg: spec.kg,
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: adminUserId,
        },
      });
    }
  }
}

async function createEligibleStoreBase(options: {
  country: string;
  line2?: string | null;
  suburb?: string | null;
  postalCode?: string;
  latitude?: string | null;
  longitude?: string | null;
  omitDefaultPickup?: boolean;
  legacyStoreAddressOnly?: boolean;
  legalIdentityStatus?: "APPROVED" | "RETIRED";
}): Promise<CreatedScenario> {
  const label = randomUUID();
  const shortTag = label.replace(/-/g, "").slice(0, 10);

  const owner = await prisma.user.create({
    data: {
      email: `cp-own-${shortTag}@example.test`,
      role: "STORE",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      phone: "+27820001234",
    },
  });
  const admin1 = await prisma.user.create({
    data: {
      email: `cp-adm1-${shortTag}@example.test`,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });
  const admin2 = await prisma.user.create({
    data: {
      email: `cp-adm2-${shortTag}@example.test`,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  const store = await prisma.store.create({
    data: {
      ownerUserId: owner.id,
      name: `Country Parity Store ${shortTag}`,
      slug: `cp-store-${shortTag}`,
      status: "PENDING",
      contactEmail: owner.email,
      contactPhone: "+27820001234",
      ...(options.legacyStoreAddressOnly
        ? {
            addressLine1: "22 Sandton Drive",
            addressLine2: "Sandton",
            city: "Johannesburg",
            province: "Gauteng",
            postalCode: "2196",
            country: options.country,
          }
        : {}),
    },
  });

  const pickup = await prisma.address.create({
    data: {
      storeId: store.id,
      type: "PICKUP",
      isDefault: !options.omitDefaultPickup && !options.legacyStoreAddressOnly,
      line1: "22 Sandton Drive",
      line2: options.line2 === undefined ? "Sandton" : options.line2,
      suburb: options.suburb === undefined ? "Sandton" : options.suburb,
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: options.postalCode === undefined ? "2196" : options.postalCode,
      country: options.country,
      latitude: options.latitude === undefined ? "-26.1076000" : options.latitude,
      longitude: options.longitude === undefined ? "28.0567000" : options.longitude,
      placeId: `place_cp_${shortTag}`,
    },
  });

  if (!options.omitDefaultPickup && !options.legacyStoreAddressOnly) {
    await prisma.store.update({
      where: { id: store.id },
      data: { defaultPickupAddressId: pickup.id },
    });
  }

  await prisma.storeSellerLegalIdentity.create({
    data: {
      storeId: store.id,
      publicReference: `SID-CP-${shortTag}`,
      identityVersion: "CP_SOLE_TRADER_V1",
      legalName: "Country Parity Sole Trader",
      tradingName: store.name,
      vatRegistrationStatus: "NOT_REGISTERED",
      invoiceClassification: "RECEIPT",
      status: options.legalIdentityStatus ?? "APPROVED",
      effectiveFrom: new Date(Date.now() - 60_000),
    },
  });

  const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
    where: { status: "ACTIVE" },
  });
  if (!existingPolicy) {
    const policy = await prisma.storeOrderOperationalPolicy.create({
      data: {
        publicReference: `SOP-CP-${shortTag}`,
        name: `cp-policy-${shortTag}`,
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
    createdPolicyIds.push(policy.id);
  }

  await ensureParcelProfilesExist(admin1.id);

  const commissionPlan = await createCommissionPlan({
    subjectType: "MARKETPLACE_STORE_ORDER",
    scopeKey: `STORE:${store.id}`,
    basisType: "ORDER_SUBTOTAL",
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    calculationVersion: `cp-plan-${shortTag}`,
    rules: [
      {
        ruleCode: "STORE_PLATFORM_FEE",
        allocationType: "PLATFORM_COMMISSION_REVENUE",
        beneficiaryType: "PLATFORM",
        calculationMethod: "PERCENTAGE_BPS",
        rateBasisPoints: 800,
        priority: 1,
      },
    ],
    actorUserId: admin1.id,
    operationId: randomUUID(),
  });
  cleanupCommissionPlanIds.push(commissionPlan.id);
  await submitCommissionPlan(commissionPlan.id, admin1.id, randomUUID());
  await approveCommissionPlan(commissionPlan.id, admin2.id, randomUUID());
  await activateCommissionPlan(commissionPlan.id, admin2.id, randomUUID());

  let region = await prisma.deliveryRegion.findUnique({
    where: { slug: "cp-sandton-shared" },
  });
  if (!region) {
    region = await prisma.deliveryRegion.create({
      data: {
        name: "CP Sandton Shared",
        slug: "cp-sandton-shared",
        city: "Johannesburg",
        province: "Gauteng",
        coverageMode: "RADIUS",
        centerLat: "-26.1076000",
        centerLng: "28.0567000",
        coverageRadiusKm: "40.00",
        maxDistanceKm: "50.00",
        displayOrder: -100,
        active: true,
        pricingEnabled: true,
      },
    });
    cleanupRegionIds.push(region.id);
  }

  let service = cleanupServiceIds.length
    ? await prisma.deliveryServiceDefinition.findUnique({ where: { id: cleanupServiceIds[0]! } })
    : null;
  if (!service) {
    const latestClientStd = await prisma.deliveryServiceDefinition.findFirst({
      where: { stableKey: "CLIENT_STANDARD" },
      orderBy: { versionNumber: "desc" },
    });
    service = await prisma.deliveryServiceDefinition.create({
      data: {
        stableKey: "CLIENT_STANDARD",
        versionNumber: (latestClientStd?.versionNumber ?? 0) + 1,
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
            SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
            MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
            LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
          },
          expectedVersion: latestClientStd?.versionNumber ?? 0,
          reason: `Country parity service fixture ${shortTag}`,
        },
        coveragePolicy: {
          provinces: ["Gauteng"],
          regionIds: [region.id],
        },
        slaMetadata: { turnaround: "1-2 business days" },
      },
    });
    cleanupServiceIds.push(service.id);
  }

  await setStoreStatus(store.id, "ACTIVE", {
    actorUserId: admin1.id,
    reason: "Verified owner email and business contact details",
  });

  const category = await prisma.catalogCategory.create({
    data: {
      publicReference: catalogPublicReference("CC"),
      name: `CP Cat ${shortTag}`,
      slug: `cp-cat-${shortTag}`,
      path: `/cp-cat-${shortTag}`,
      depth: 0,
      status: "ACTIVE",
      createdByUserId: admin1.id,
      updatedByUserId: admin1.id,
    },
  });
  const productType = await prisma.productTypeDefinition.create({
    data: {
      publicReference: catalogPublicReference("PT"),
      code: `CP_TYPE_${shortTag.toUpperCase()}`,
      name: `CP Type ${shortTag}`,
      versionNumber: 1,
      status: "ACTIVE",
      attributeSchema: { attributes: [] },
      variantSchema: {},
      complianceSchema: { requirements: [] },
      searchFacetSchema: {},
      createdByUserId: admin1.id,
    },
  });
  const invLocation = await createStoreInventoryLocation(store.id, owner.id, {
    name: `CP Stockroom ${shortTag}`,
    operationId: randomUUID(),
  });
  const intake = new CatalogMediaIntakeService(
    new PrismaCatalogMediaRepository(),
    new DeterministicCatalogMediaStorageAdapter(),
  );
  const pngBytes = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 40, g: 130, b: 90 } },
  })
    .png()
    .toBuffer();
  const intent = await intake.createUploadIntent({
    actorUserId: owner.id,
    ownerType: "STORE",
    storeId: store.id,
    purpose: "PRODUCT_IMAGE",
    declaredMimeType: "image/png",
    declaredByteSize: pngBytes.length,
    operationId: randomUUID(),
  });
  await intake.receiveUploadBytes({
    actorUserId: owner.id,
    storeId: store.id,
    uploadReference: intent.upload.publicReference,
    operationId: randomUUID(),
    bytes: pngBytes,
  });
  const readyMedia = await intake.completeUpload({
    actorUserId: owner.id,
    storeId: store.id,
    uploadReference: intent.upload.publicReference,
    operationId: randomUUID(),
  });

  const draft = await createStoreCatalogListingDraft(store.id, owner.id, {
    operationId: randomUUID(),
    product: {
      scope: "STORE_PRIVATE",
      productTypeDefinitionId: productType.id,
      primaryCategoryId: category.id,
      title: `Country Parity Item ${shortTag}`,
      description: "Real sellable product for merchant country-code parity test.",
      condition: "NEW",
      attributeValues: {},
      complianceValues: {},
    },
    variants: [],
    storeSku: `CP-${shortTag}`,
    price: {
      amount: "85.00",
      currency: "ZAR",
      priceIncludesTax: false,
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    },
    openingStock: 8,
    inventoryLocationPublicReference: invLocation.publicReference,
    packaging: {
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      weightKg: 0.7,
      description: "Sealed standard parcel",
    },
    modifiers: [],
    media: [
      {
        assetPublicReference: readyMedia.asset.publicReference,
        altText: "Country parity product image",
        displayOrder: 0,
        primary: true,
        variantAssociation: "PRODUCT",
      },
    ],
  });

  const offerRef = draft.offers[0]!.publicReference;
  const variantRef = draft.variants[0]!.publicReference;
  const priceVersionRef = draft.offers[0]!.priceVersions[0]!.publicReference;
  cleanupSettingKeys.push(`${PACKAGING_PREFIX}${offerRef}`);

  const subProd = await submitStoreCatalogProduct(store.id, draft.publicReference, owner.id, {
    version: draft.version,
    operationId: randomUUID(),
  });
  const appProd = await moderateCatalogProduct(subProd.id, admin1.id, "APPROVE", {
    version: subProd.version,
    operationId: randomUUID(),
    reasonCode: "CP_PRODUCT_APPROVAL",
  });
  const subOffer = await transitionStoreCatalogOffer(store.id, offerRef, owner.id, "SUBMITTED", {
    version: draft.offers[0]!.version,
    operationId: randomUUID(),
  });
  const appOffer = await moderateCatalogOffer(subOffer.id, admin1.id, "APPROVE", {
    version: subOffer.version,
    operationId: randomUUID(),
    reasonCode: "CP_OFFER_APPROVAL",
  });
  const published = await publishApprovedCatalogListing(appOffer.id, admin2.id, {
    version: appOffer.version,
    productVersion: appProd.version,
    priceVersionReference: priceVersionRef,
    operationId: randomUUID(),
    reasonCode: "CP_PUBLICATION",
  });

  const pkgSetting = await prisma.systemSetting.findUniqueOrThrow({
    where: { key: `${PACKAGING_PREFIX}${offerRef}` },
  });
  const pkgRevision = (pkgSetting.value as { revision: string }).revision;
  const versions = await listTrustedPackageVersions();
  const activePkgVersion = versions
    .filter((v) => v.status === "ACTIVE")
    .sort((a, b) => b.version - a.version)[0];
  const latestPkgVersion = Math.max(0, ...versions.map((v) => v.version));
  const savedPkg = await saveTrustedPackageVersion(admin1.id, {
    packages: [
      ...(activePkgVersion?.packages ?? []).filter((p) => p.offerReference !== offerRef),
      {
        storeId: store.id,
        offerReference: offerRef,
        variantReference: variantRef,
        publicationVersion: String(published.offer.version),
        modifiers: [],
        packingRule: "SINGLE_PREPACKAGED_UNIT",
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        weightKg: 0.7,
        authorityReference: `${PACKAGING_PREFIX}${offerRef}:${pkgRevision}`,
      },
    ],
    bundles: activePkgVersion?.bundles ?? [],
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    effectiveTo: null,
    expectedVersion: latestPkgVersion,
    reason: `Trusted package for country parity ${shortTag}`,
  });
  const pkgKey = `production_marketplace_trusted_packages_v${savedPkg.version}`;
  cleanupSettingKeys.push(pkgKey);
  const pkgRow = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
  const approvedPkg = await actOnTrustedPackageVersion(admin2.id, {
    version: savedPkg.version,
    expectedUpdatedAt: pkgRow.updatedAt.toISOString(),
    action: "APPROVE",
    reason: "Independent packaging approval",
  });
  const pkgRow2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
  await actOnTrustedPackageVersion(admin2.id, {
    version: savedPkg.version,
    expectedUpdatedAt: pkgRow2.updatedAt.toISOString(),
    action: "ACTIVATE",
    reason: `Activate packaging v${approvedPkg.version}`,
  });

  return {
    label,
    ownerId: owner.id,
    admin1Id: admin1.id,
    admin2Id: admin2.id,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    pickupId: pickup.id,
    regionId: region.id,
    serviceId: service.id,
    commissionPlanId: commissionPlan.id,
    productRef: draft.publicReference,
    offerRef,
    priceVersionRef,
    trustedPackageVersion: approvedPkg.version,
  };
}

/**
 * Persists a genuinely constructed StoreCheckoutCertification snapshot from the real
 * 6-stage SAVEPOINT engine proof (used to isolate and test the PostgreSQL SQL
 * publication predicate directly against historical/persisted pickup country labels).
 */
async function persistEngineProofCertificationSnapshot(
  s: CreatedScenario,
  overrides?: {
    status?: "APPROVED" | "PENDING_REVIEW" | "REVOKED";
    selfApproved?: boolean;
    expired?: boolean;
    forceStorefrontActive?: boolean;
    stalePickupFingerprint?: boolean;
  },
) {
  const pickup = await prisma.address.findUniqueOrThrow({ where: { id: s.pickupId } });
  const sellerIdentity = await prisma.storeSellerLegalIdentity.findFirst({
    where: { storeId: s.storeId },
    orderBy: { effectiveFrom: "desc" },
  });
  const opPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { versionNumber: "desc" },
  });
  const plan = await prisma.commissionPlan.findUnique({ where: { id: s.commissionPlanId } });
  const service = await prisma.deliveryServiceDefinition.findUniqueOrThrow({
    where: { id: s.serviceId },
  });

  const matchingServiceVersions = [`${service.stableKey}:v${service.versionNumber}`];
  const serviceSignature = createHash("sha256")
    .update(matchingServiceVersions.join("|"))
    .digest("hex");
  const pickupFingerprint = overrides?.stalePickupFingerprint
    ? "0".repeat(64)
    : pickupCertificationFingerprint(pickup);

  const engineProof = await runDisposableStoreCheckoutEngineProof({
    storeId: s.storeId,
    pickupAddressId: pickup.id,
    pickupFingerprint,
    coverageRegionId: s.regionId,
    coverageRegionName: `CP Sandton ${s.label.slice(0, 8)}`,
    matchingServiceVersions,
    serviceSignature,
    routeDistanceMeters: 4200,
    routeDurationSeconds: 780,
    sellerIdentityReference: sellerIdentity?.publicReference ?? null,
    sellerIdentityVersion: sellerIdentity?.identityVersion ?? null,
    operationalPolicyReference: opPolicy?.publicReference ?? null,
    commissionPlanReference: plan?.publicReference ?? null,
    paymentProviderReadiness: preflightOpts.paymentProviderReadiness,
  });

  expect(engineProof.passed).toBe(true);

  const routeDigest = createHash("sha256")
    .update(`route:${s.storeId}:${pickup.id}:${pickupFingerprint}:${s.regionId}`)
    .digest("hex");
  const checkoutDigest = createHash("sha256")
    .update(`checkout:${s.storeId}:${pickup.id}:${pickupFingerprint}:${engineProof.engineProofDigest}`)
    .digest("hex");
  const token = s.storeId.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24) || "store";

  const status = overrides?.status ?? "APPROVED";
  const approvedByUserId = overrides?.selfApproved ? s.admin1Id : s.admin2Id;
  const expiresAt = overrides?.expired
    ? new Date(Date.now() - 60_000)
    : new Date(Date.now() + 30 * 86400_000);

  await prisma.storeCheckoutCertification.upsert({
    where: { storeId: s.storeId },
    create: {
      storeId: s.storeId,
      pickupAddressId: pickup.id,
      pickupFingerprint,
      coverageRegionId: s.regionId,
      serviceSignature,
      routeEvidenceReference: `preflight-route:${token}:${routeDigest.slice(0, 24)}`,
      routeEvidenceDigest: routeDigest,
      checkoutEvidenceReference: `preflight-checkout:${token}:${checkoutDigest.slice(0, 24)}`,
      checkoutEvidenceDigest: checkoutDigest,
      evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
      engineProofReference: engineProof.engineProofReference,
      engineProofDigest: engineProof.engineProofDigest,
      engineProofSuiteSha: engineProof.suiteSha,
      policyFingerprint: engineProof.policyFingerprint,
      sourceCommerceReadinessRevision: engineProof.sourceCommerceReadinessRevision,
      globalPolicyRevision: engineProof.globalPolicyRevision,
      proofOfferReference: engineProof.proofOfferReference,
      proofPriceVersionReference: engineProof.proofPriceVersionReference,
      proofMetadata: engineProof.proofMetadata as unknown as Prisma.InputJsonValue,
      stageResults: engineProof.stageResults as unknown as Prisma.InputJsonValue,
      preparedByUserId: s.admin1Id,
      approvedByUserId: status === "PENDING_REVIEW" ? null : approvedByUserId,
      approvedAt: status === "PENDING_REVIEW" ? null : new Date(),
      status,
      expiresAt,
      reviewNote: "Canonical disposable real-source SAVEPOINT capability proof snapshot.",
    },
    update: {
      pickupAddressId: pickup.id,
      pickupFingerprint,
      status,
      approvedByUserId: status === "PENDING_REVIEW" ? null : approvedByUserId,
      expiresAt,
      revision: { increment: 1 },
    },
  });

  await rebuildStorefrontStoreDocument(s.storeId);

  if (overrides?.forceStorefrontActive) {
    await prisma.storefrontStoreDocument.updateMany({
      where: { storeId: s.storeId },
      data: { publicStatus: "ACTIVE", publishedOfferCount: 1 },
    });
  }
}

async function assertPublicStorefrontVisibility(s: CreatedScenario, expectedVisible: boolean) {
  const searchService = new StorefrontSearchService(new PostgresStorefrontSearchAdapter());
  const [stores, storeDetail, docs, productDetail, searchResult] = await Promise.all([
    listStorefrontStores({ query: s.storeName }),
    getStorefrontStore(s.storeSlug),
    loadStorefrontDocuments({ storeSlug: s.storeSlug }),
    getStorefrontProduct(s.productRef),
    searchService.search({ store: s.storeSlug }),
  ]);

  if (expectedVisible) {
    expect(stores.some((entry) => entry.slug === s.storeSlug)).toBe(true);
    expect(storeDetail).not.toBeNull();
    expect(storeDetail?.slug).toBe(s.storeSlug);
    expect(storeDetail?.products.length).toBeGreaterThanOrEqual(1);
    expect(docs).toHaveLength(1);
    expect(productDetail).not.toBeNull();
    expect(productDetail?.offers.some((o) => o.offerReference === s.offerRef)).toBe(true);
    expect(searchResult.resultCount).toBe(1);
  } else {
    expect(stores.some((entry) => entry.slug === s.storeSlug)).toBe(false);
    expect(storeDetail).toBeNull();
    expect(docs).toHaveLength(0);
    expect(productDetail).toBeNull();
    expect(searchResult.resultCount).toBe(0);
  }
}

describe("P1: Merchant pickup country-code parity & negative controls on real PostgreSQL", () => {
  beforeAll(() => {
    if (!isSafeLocalTestDatabaseUrl(process.env.DATABASE_URL)) {
      throw new Error("Safe disposable local PostgreSQL DATABASE_URL is required.");
    }
  });

  afterAll(async () => {
    if (cleanupSettingKeys.length) {
      await prisma.systemSetting.deleteMany({ where: { key: { in: cleanupSettingKeys } } }).catch(() => {});
    }
    if (cleanupServiceIds.length) {
      await prisma.deliveryServiceDefinition.deleteMany({ where: { id: { in: cleanupServiceIds } } }).catch(() => {});
    }
    if (cleanupRegionIds.length) {
      await prisma.deliveryRegion.deleteMany({ where: { id: { in: cleanupRegionIds } } }).catch(() => {});
    }
    if (cleanupCommissionPlanIds.length) {
      await prisma.commissionPlanStatusHistory
        .deleteMany({ where: { planId: { in: cleanupCommissionPlanIds } } })
        .catch(() => {});
      await prisma.commissionRule.deleteMany({ where: { planId: { in: cleanupCommissionPlanIds } } }).catch(() => {});
      await prisma.commissionPlan.deleteMany({ where: { id: { in: cleanupCommissionPlanIds } } }).catch(() => {});
    }
    if (createdPolicyIds.length) {
      await prisma.storeOrderOperationalPolicy.deleteMany({ where: { id: { in: createdPolicyIds } } }).catch(() => {});
    }
  });

  describe("End-to-end preflight -> 6-stage engine proof -> independent approval -> SQL storefront publication", () => {
    it.each([
      { label: "South Africa", country: "South Africa" },
      { label: "ZA", country: "ZA" },
      { label: "RSA", country: "RSA" },
      { label: "ZAF", country: "ZAF" },
      { label: "trimmed/spaced rsa", country: " rsa " },
      { label: "collapsed South  Africa", country: "South  Africa" },
    ])(
      "certifies and publicly publishes a genuinely eligible store with country=$label",
      async ({ country }) => {
        const s = await createEligibleStoreBase({ country });
        const pickup = await prisma.address.findUniqueOrThrow({ where: { id: s.pickupId } });

        expect(isMerchantPickupEvidenceComplete({ ...pickup, latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) })).toBe(true);
        const coords = await resolveVerifiedStorePickupCoordinates(pickup);
        expect(coords).toEqual({ latitude: -26.1076, longitude: 28.0567 });

        const preflight = await evaluateStoreCheckoutCapabilityPreflight(s.storeId, preflightOpts);
        expect(preflight?.capabilityBlockers).toEqual([]);
        expect(preflight?.preflightReady).toBe(true);

        const prepared = await prepareStoreCheckoutCertificationFromPreflight(
          s.storeId,
          s.admin1Id,
          `Country parity certification proof for ${country}`,
          preflightOpts,
        );
        expect(prepared.evidenceType).toBe(REAL_CHECKOUT_PROOF_EVIDENCE_TYPE);

        await expect(
          approveStoreCheckoutCertification(s.storeId, s.admin1Id, prepared.revision, preflightOpts),
        ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });

        const approved = await approveStoreCheckoutCertification(
          s.storeId,
          s.admin2Id,
          prepared.revision,
          preflightOpts,
        );
        expect(approved.status).toBe("APPROVED");

        await assertPublicStorefrontVisibility(s, true);
      },
      90_000,
    );
  });

  describe("Direct PostgreSQL SQL publication predicate evaluation (isolated certification snapshots)", () => {
    it.each([
      { label: "South Africa", country: "South Africa" },
      { label: "ZA", country: "ZA" },
      { label: "RSA", country: "RSA" },
      { label: "ZAF", country: "ZAF" },
      { label: "trimmed lowercase zaf", country: " zaf " },
      { label: "collapsed South  Africa", country: "South  Africa" },
    ])(
      "publishes persisted valid certification snapshot for country=$label through SQL storefront predicate",
      async ({ country }) => {
        const s = await createEligibleStoreBase({ country });
        await persistEngineProofCertificationSnapshot(s);

        const doc = await prisma.storefrontStoreDocument.findUniqueOrThrow({
          where: { storeId: s.storeId },
        });
        expect(doc.publicStatus).toBe("ACTIVE");

        await assertPublicStorefrontVisibility(s, true);
      },
      90_000,
    );
  });

  describe("Negative controls, boundary inputs, history fallback, and drift invalidation", () => {
    it(
      "excludes non-South-African country US",
      async () => {
        const usStore = await createEligibleStoreBase({ country: "US" });
        await persistEngineProofCertificationSnapshot(usStore, { forceStorefrontActive: true });
        expect(
          await resolveVerifiedStorePickupCoordinates(
            await prisma.address.findUniqueOrThrow({ where: { id: usStore.pickupId } }),
          ),
        ).toBeNull();
        expect(
          isMerchantPickupEvidenceComplete({
            ...(await prisma.address.findUniqueOrThrow({ where: { id: usStore.pickupId } })),
            latitude: -26.1076,
            longitude: 28.0567,
          }),
        ).toBe(false);
        await assertPublicStorefrontVisibility(usStore, false);
      },
      90_000,
    );

    it(
      "excludes malformed postal codes (ABC, 219, empty) even when storefront row is forced ACTIVE",
      async () => {
        const badPostalAlpha = await createEligibleStoreBase({ country: "ZA", postalCode: "ABC" });
        await persistEngineProofCertificationSnapshot(badPostalAlpha, { forceStorefrontActive: true });
        expect(
          isMerchantPickupEvidenceComplete({
            ...(await prisma.address.findUniqueOrThrow({ where: { id: badPostalAlpha.pickupId } })),
            latitude: -26.1076,
            longitude: 28.0567,
          }),
        ).toBe(false);
        await assertPublicStorefrontVisibility(badPostalAlpha, false);

        const badPostalShort = await createEligibleStoreBase({ country: "South Africa", postalCode: "219" });
        await persistEngineProofCertificationSnapshot(badPostalShort, { forceStorefrontActive: true });
        await assertPublicStorefrontVisibility(badPostalShort, false);

        const emptyPostal = await createEligibleStoreBase({ country: "South Africa", postalCode: "" });
        await persistEngineProofCertificationSnapshot(emptyPostal, { forceStorefrontActive: true });
        await assertPublicStorefrontVisibility(emptyPostal, false);
      },
      90_000,
    );

    it(
      "excludes out-of-South-Africa, zero, and missing coordinates",
      async () => {
        const badCoordsOutOfSa = await createEligibleStoreBase({
          country: "South Africa",
          latitude: "-10.0000000",
          longitude: "28.0567000",
        });
        await persistEngineProofCertificationSnapshot(badCoordsOutOfSa, { forceStorefrontActive: true });
        await assertPublicStorefrontVisibility(badCoordsOutOfSa, false);

        const zeroCoords = await createEligibleStoreBase({ country: "ZA" });
        await persistEngineProofCertificationSnapshot(zeroCoords);
        await assertPublicStorefrontVisibility(zeroCoords, true);
        const zeroPickup = await prisma.address.update({
          where: { id: zeroCoords.pickupId },
          data: { latitude: "0.0000000", longitude: "0.0000000" },
        });
        expect(() => pickupCertificationFingerprint(zeroPickup)).toThrow();
        await assertPublicStorefrontVisibility(zeroCoords, false);

        const missingCoords = await createEligibleStoreBase({ country: "RSA" });
        await persistEngineProofCertificationSnapshot(missingCoords);
        await assertPublicStorefrontVisibility(missingCoords, true);
        const nullPickup = await prisma.address.update({
          where: { id: missingCoords.pickupId },
          data: { latitude: null, longitude: null },
        });
        expect(() => pickupCertificationFingerprint(nullPickup)).toThrow();
        await assertPublicStorefrontVisibility(missingCoords, false);
      },
      90_000,
    );

    it(
      "excludes unit-only line2 (Unit 4 with missing suburb) and accepts unit line2 + valid suburb",
      async () => {
        const unitOnlyLine2 = await createEligibleStoreBase({
          country: "South Africa",
          line2: "Unit 4",
          suburb: null,
        });
        await persistEngineProofCertificationSnapshot(unitOnlyLine2, { forceStorefrontActive: true });
        expect(
          isMerchantPickupEvidenceComplete({
            ...(await prisma.address.findUniqueOrThrow({ where: { id: unitOnlyLine2.pickupId } })),
            latitude: -26.1076,
            longitude: 28.0567,
          }),
        ).toBe(false);
        await assertPublicStorefrontVisibility(unitOnlyLine2, false);

        const unitWithSuburb = await createEligibleStoreBase({
          country: "ZAF",
          line2: "Unit 4",
          suburb: "Sandton",
        });
        await persistEngineProofCertificationSnapshot(unitWithSuburb);
        await assertPublicStorefrontVisibility(unitWithSuburb, true);
      },
      90_000,
    );

    it(
      "blocks history fallback, uncertified/pending/self-approved/expired certs, and retired legal identity",
      async () => {
        const legacyFallback = await createEligibleStoreBase({
          country: "South Africa",
          legacyStoreAddressOnly: true,
        });
        await prisma.storefrontStoreDocument.upsert({
          where: { storeId: legacyFallback.storeId },
          create: {
            storeId: legacyFallback.storeId,
            storePublicReference: legacyFallback.storeSlug,
            slug: legacyFallback.storeSlug,
            name: legacyFallback.storeName,
            publicCategoryCodes: [],
            fulfilmentModes: ["LOCAL_COURIER"],
            serviceAreaReferences: [],
            publicStatus: "ACTIVE",
            publishedOfferCount: 1,
            sourceUpdatedAt: new Date(),
            indexedAt: new Date(),
          },
          update: { publicStatus: "ACTIVE", publishedOfferCount: 1 },
        });
        await assertPublicStorefrontVisibility(legacyFallback, false);

        const pendingCert = await createEligibleStoreBase({ country: "RSA" });
        await persistEngineProofCertificationSnapshot(pendingCert, {
          status: "PENDING_REVIEW",
          forceStorefrontActive: true,
        });
        await assertPublicStorefrontVisibility(pendingCert, false);

        const selfApproved = await createEligibleStoreBase({ country: "ZAF" });
        await persistEngineProofCertificationSnapshot(selfApproved, {
          selfApproved: true,
          forceStorefrontActive: true,
        });
        await assertPublicStorefrontVisibility(selfApproved, false);

        const expiredCert = await createEligibleStoreBase({ country: "ZA" });
        await persistEngineProofCertificationSnapshot(expiredCert, {
          expired: true,
          forceStorefrontActive: true,
        });
        await assertPublicStorefrontVisibility(expiredCert, false);

        const retiredIdentity = await createEligibleStoreBase({ country: "ZA" });
        await persistEngineProofCertificationSnapshot(retiredIdentity);
        await assertPublicStorefrontVisibility(retiredIdentity, true);
        await prisma.storeSellerLegalIdentity.updateMany({
          where: { storeId: retiredIdentity.storeId },
          data: { status: "RETIRED" },
        });
        await assertPublicStorefrontVisibility(retiredIdentity, false);
      },
      120_000,
    );

    it(
      "invalidates certification and withdraws storefront visibility on pickup drift (RSA)",
      async () => {
        const driftStore = await createEligibleStoreBase({ country: "RSA" });
        await persistEngineProofCertificationSnapshot(driftStore);
        await assertPublicStorefrontVisibility(driftStore, true);

        await prisma.address.update({
          where: { id: driftStore.pickupId },
          data: { line1: "99 Moved Sandton Lane" },
        });
        // Immediate SQL protection before explicit revalidation
        await assertPublicStorefrontVisibility(driftStore, false);
        const reval = await revalidateStoreCheckoutCertification(
          driftStore.storeId,
          driftStore.admin2Id,
          preflightOpts,
        );
        expect(reval.revoked).toBe(true);
        await assertPublicStorefrontVisibility(driftStore, false);
      },
      90_000,
    );
  });
});
