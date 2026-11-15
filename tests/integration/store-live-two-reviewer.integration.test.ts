import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
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
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersions,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import {
  prepareStoreCheckoutCertification,
  prepareStoreCheckoutCertificationFromPreflight,
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  revalidateStoreCheckoutCertification,
  StoreCertificationError,
} from "@/lib/admin/store-checkout-certification.service";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import {
  activateCommissionPlan,
  approveCommissionPlan,
  createCommissionPlan,
  submitCommissionPlan,
} from "@/lib/services/commission-plan.service";

vi.mock("@/lib/admin/store-pickup-preflight.service", () => ({
  getStorePickupOperationalPreflight: vi.fn(async () => ({
    blockers: [], pickupRegionId: "isolated-covered-jhb", pickupRegionName: "Johannesburg",
    matchingServiceVersions: ["service-1:1"], matchingServiceCount: 1,
  })),
}));

async function seedRealPublishedOfferForProof(params: {
  storeId: string;
  ownerId: string;
  admin1Id: string;
  admin2Id: string;
  label: string;
}) {
  const { storeId, ownerId, admin1Id, admin2Id, label } = params;
  const tag = label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const category = await prisma.catalogCategory.create({
    data: {
      publicReference: catalogPublicReference("CC"),
      name: `TwoRev Category ${tag}`,
      slug: `tworev-cat-${tag}-${randomUUID().slice(0, 6)}`,
      path: `/tworev-cat-${tag}-${randomUUID().slice(0, 6)}`,
      depth: 0,
      status: "ACTIVE",
      createdByUserId: admin1Id,
      updatedByUserId: admin1Id,
    },
  });
  const definition = await prisma.productTypeDefinition.create({
    data: {
      publicReference: catalogPublicReference("PT"),
      code: `TWOREV_${tag.toUpperCase()}_${randomUUID().slice(0, 6).toUpperCase()}`,
      name: `TwoRev Type ${tag}`,
      versionNumber: 1,
      status: "ACTIVE",
      attributeSchema: { attributes: [] },
      variantSchema: {},
      complianceSchema: { requirements: [] },
      searchFacetSchema: {},
      createdByUserId: admin1Id,
    },
  });
  const location = await createStoreInventoryLocation(storeId, ownerId, {
    name: `Proof Stockroom ${tag}`,
    operationId: randomUUID(),
  });
  const intake = new CatalogMediaIntakeService(
    new PrismaCatalogMediaRepository(),
    new DeterministicCatalogMediaStorageAdapter(),
  );
  const bytes = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 70, g: 130, b: 180 } },
  })
    .png()
    .toBuffer();
  const intent = await intake.createUploadIntent({
    actorUserId: ownerId,
    ownerType: "STORE",
    storeId,
    purpose: "PRODUCT_IMAGE",
    declaredMimeType: "image/png",
    declaredByteSize: bytes.length,
    operationId: randomUUID(),
  });
  await intake.receiveUploadBytes({
    actorUserId: ownerId,
    storeId,
    uploadReference: intent.upload.publicReference,
    operationId: randomUUID(),
    bytes,
  });
  const readyMedia = await intake.completeUpload({
    actorUserId: ownerId,
    storeId,
    uploadReference: intent.upload.publicReference,
    operationId: randomUUID(),
  });
  const draft = await createStoreCatalogListingDraft(storeId, ownerId, {
    operationId: randomUUID(),
    product: {
      scope: "STORE_PRIVATE",
      productTypeDefinitionId: definition.id,
      primaryCategoryId: category.id,
      title: `TwoRev Proof Item ${tag}`,
      description: "Sellable proof catalog listing.",
      condition: "NEW",
      attributeValues: {},
      complianceValues: {},
    },
    variants: [],
    storeSku: `TR-${tag}`,
    price: {
      amount: "79.00",
      currency: "ZAR",
      priceIncludesTax: false,
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    },
    openingStock: 4,
    inventoryLocationPublicReference: location.publicReference,
    packaging: {
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      weightKg: 0.8,
      description: "Protected courier carton",
    },
    modifiers: [],
    media: [
      {
        assetPublicReference: readyMedia.asset.publicReference,
        altText: "Proof product",
        displayOrder: 0,
        primary: true,
        variantAssociation: "PRODUCT",
      },
    ],
  });
  const offerRef = draft.offers[0]!.publicReference;
  const variantRef = draft.variants[0]!.publicReference;
  const subProd = await submitStoreCatalogProduct(storeId, draft.publicReference, ownerId, {
    version: draft.version,
    operationId: randomUUID(),
  });
  const appProd = await moderateCatalogProduct(subProd.id, admin1Id, "APPROVE", {
    version: subProd.version,
    operationId: randomUUID(),
    reasonCode: "TWOREV_PRODUCT_APPROVAL",
  });
  const subOffer = await transitionStoreCatalogOffer(storeId, offerRef, ownerId, "SUBMITTED", {
    version: draft.offers[0]!.version,
    operationId: randomUUID(),
  });
  const appOffer = await moderateCatalogOffer(subOffer.id, admin1Id, "APPROVE", {
    version: subOffer.version,
    operationId: randomUUID(),
    reasonCode: "TWOREV_OFFER_APPROVAL",
  });
  const published = await publishApprovedCatalogListing(appOffer.id, admin2Id, {
    version: appOffer.version,
    productVersion: appProd.version,
    priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
    operationId: randomUUID(),
    reasonCode: "TWOREV_PUBLICATION",
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
  const savedPkg = await saveTrustedPackageVersion(admin1Id, {
    packages: [
      ...(activePkgVersion?.packages ?? []).filter((p) => p.offerReference !== offerRef),
      {
        storeId,
        offerReference: offerRef,
        variantReference: variantRef,
        publicationVersion: String(published.offer.version),
        modifiers: [],
        packingRule: "SINGLE_PREPACKAGED_UNIT",
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        weightKg: 0.8,
        authorityReference: `${PACKAGING_PREFIX}${offerRef}:${pkgRevision}`,
      },
    ],
    bundles: activePkgVersion?.bundles ?? [],
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    effectiveTo: null,
    expectedVersion: latestPkgVersion,
    reason: "Trusted measurement for real-source checkout capability proof",
  });
  const pkgKey = `production_marketplace_trusted_packages_v${savedPkg.version}`;
  const pkgRow = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
  const approvedPkg = await actOnTrustedPackageVersion(admin2Id, {
    version: savedPkg.version,
    expectedUpdatedAt: pkgRow.updatedAt.toISOString(),
    action: "APPROVE",
    reason: "Independent packaging approval",
  });
  const pkgRow2 = await prisma.systemSetting.findUniqueOrThrow({ where: { key: pkgKey } });
  await actOnTrustedPackageVersion(admin2Id, {
    version: savedPkg.version,
    expectedUpdatedAt: pkgRow2.updatedAt.toISOString(),
    action: "ACTIVATE",
    reason: `Activate packaging v${approvedPkg.version}`,
  });

  return {
    offerRef,
    cleanup: async () => {
      // Only remove global SystemSetting packaging keys so they do not spill into subsequent tests;
      // catalog publication snapshots and storefront projection history are append-only in PostgreSQL.
      await prisma.systemSetting.deleteMany({
        where: { key: { in: [`${PACKAGING_PREFIX}${offerRef}`, pkgKey] } },
      });
    },
  };
}

async function ensureAllParcelProfiles(createdByUserId: string) {
  const now = new Date();
  const defs = [
    { stableKey: "SMALL", displayName: "Small Parcel", l: 30, w: 20, h: 10, kg: 5 },
    { stableKey: "MEDIUM", displayName: "Medium Parcel", l: 45, w: 35, h: 25, kg: 15 },
    { stableKey: "LARGE", displayName: "Large Parcel", l: 70, w: 50, h: 40, kg: 30 },
  ] as const;
  for (const def of defs) {
    const count = await prisma.parcelProfileVersion.count({
      where: {
        stableKey: def.stableKey,
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
    });
    if (count === 0) {
      await prisma.parcelProfileVersion.create({
        data: {
          stableKey: def.stableKey,
          displayName: def.displayName,
          versionNumber: 1,
          status: "ACTIVE",
          lengthCm: def.l,
          widthCm: def.w,
          heightCm: def.h,
          maximumWeightKg: def.kg,
          effectiveFrom: new Date(now.getTime() - 60_000),
          effectiveTo: null,
          createdByUserId,
        },
      });
    }
  }
}

const ids: { store?: string; owner?: string; admins: string[]; plans: string[]; cleanups: Array<() => Promise<void>> } = {
  admins: [],
  plans: [],
  cleanups: [],
};

async function ensureActiveStoreCommissionPlan(storeId: string, makerId: string, approverId: string) {
  const existing = await prisma.commissionPlan.findFirst({
    where: {
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${storeId}`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const plan = await createCommissionPlan({
    subjectType: "MARKETPLACE_STORE_ORDER",
    scopeKey: `STORE:${storeId}`,
    basisType: "ORDER_SUBTOTAL",
    effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    calculationVersion: "tworev-plan",
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
    actorUserId: makerId,
    operationId: randomUUID(),
  });
  ids.plans.push(plan.id);
  await submitCommissionPlan(plan.id, makerId, randomUUID());
  await approveCommissionPlan(plan.id, approverId, randomUUID());
  await activateCommissionPlan(plan.id, approverId, randomUUID());
  return plan.id;
}

describe("locked two-person store certification and activation (isolated PostgreSQL)", { timeout: 60_000 }, () => {
  afterAll(async () => {
    for (const fn of ids.cleanups) {
      await fn().catch(() => {});
    }
    for (const planId of ids.plans) {
      await prisma.commissionPlanStatusHistory.deleteMany({ where: { planId } }).catch(() => {});
      await prisma.commissionRule.deleteMany({ where: { planId } }).catch(() => {});
      await prisma.commissionPlan.deleteMany({ where: { id: planId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("decouples account approval from public live, blocks self-approval and legacy manual proofs, and certifies only real-source proof", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
        process.env.KT_NETWORK_DISABLED !== "true" || url.pathname !== "/kt_launch_test" ||
        !["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Disposable database required.");
    const label = randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: "cert-owner-" + label + "@example.test",
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        phone: "+27820001111",
      },
    });
    ids.owner = owner.id;
    for (const i of [1, 2]) {
      const admin = await prisma.user.create({
        data: {
          email: "cert-admin-" + i + "-" + label + "@example.test",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      ids.admins.push(admin.id);
    }
    const store = await prisma.store.create({ data: {
      name: "Disposable certified merchant", slug: "cert-" + label, ownerUserId: owner.id, status: "PENDING",
      contactEmail: owner.email, contactPhone: "+27820001111",
    } });
    ids.store = store.id;
    const pickup = await prisma.address.create({ data: {
      storeId: store.id, type: "PICKUP", isDefault: true, line1: "15 E2E Main Street",
      line2: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001",
      country: "South Africa", latitude: "-26.2041000", longitude: "28.0473000",
      placeId: `place_cert_${label.slice(0, 8)}`,
    } });
    await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });

    // V-001/V-002: Business account activation works without checkout certification, keeping public shop CLOSED.
    const active = await setStoreStatus(store.id, "ACTIVE", {
      actorUserId: ids.admins[0],
      reason: "Verified owner email and business contact",
    });
    expect(active.status).toBe("ACTIVE");
    const storeDocBeforeCert = await prisma.storefrontStoreDocument.findUnique({ where: { storeId: store.id } });
    expect(storeDocBeforeCert?.publicStatus ?? "INELIGIBLE").toBe("INELIGIBLE");

    await prisma.storeSellerLegalIdentity.create({
      data: {
        storeId: store.id,
        publicReference: `SID-TWO-${label.slice(0, 8)}`,
        identityVersion: "TWO_REV_V1",
        legalName: "Two Reviewer Sole Trader",
        tradingName: "Disposable certified merchant",
        vatRegistrationStatus: "NOT_REGISTERED",
        invoiceClassification: "RECEIPT",
        status: "APPROVED",
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });
    const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
      where: {
        status: "ACTIVE",
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
    });
    if (!existingPolicy) {
      await prisma.storeOrderOperationalPolicy.create({
        data: {
          publicReference: `SOP-TWO-${label.slice(0, 8)}`,
          name: `tworev-policy-${label}`,
          versionNumber: 1,
          status: "ACTIVE",
          acceptanceWindowSeconds: 900,
          customerDecisionWindowSeconds: 900,
          maximumPrepMinutes: 60,
          maximumPrepExtensionMinutes: 30,
          maximumIssueCount: 3,
          maximumSubstitutionProposalsPerLine: 2,
          effectiveFrom: new Date(Date.now() - 60_000),
          effectiveUntil: null,
          approvedByUserId: ids.admins[0],
          activatedAt: new Date(),
        },
      });
    }
    await ensureAllParcelProfiles(ids.admins[0]);
    await ensureActiveStoreCommissionPlan(store.id, ids.admins[0], ids.admins[1]);

    const preflightOpts = {
      coordinateResolver: async () => ({ latitude: -26.2041, longitude: 28.0473 }),
      zoneChecker: async () => ({
        matched: true,
        regionId: "isolated-covered-jhb",
        regionName: "Johannesburg",
        withinMaxDistance: true,
        warningMessage: null,
        calculationType: "geometric_haversine" as const,
      }),
      routeCalculator: async () => ({
        ok: true as const,
        route: {
          distanceMeters: 4200,
          durationSeconds: 780,
          routeSummary: "4.2 km · ~13 min",
          provider: "e2e_deterministic" as const,
        },
      }),
      serviceCatalogLoader: async () => [
        {
          id: "service-1",
          key: "STANDARD",
          name: "Standard",
          description: "1-2 business days",
          active: true,
          version: 1,
          provinces: ["Gauteng"],
          regionIds: ["isolated-covered-jhb"],
          baseFee: 129,
          perKmRate: 0,
          minFee: 129,
          maxFee: 249,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
        },
      ],
      commissionChecker: async () => ({
        ready: true,
        status: "READY" as const,
        planId: "plan-1",
        planReference: "CPL-TWOREV-1",
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

    // Legacy manual proof submission cannot be approved for live authority under V-003.
    const manualProof = {
      routeEvidenceReference: "isolated-route-cert-" + label,
      routeEvidenceDigest: "a".repeat(64),
      checkoutEvidenceReference: "isolated-checkout-cert-" + label,
      checkoutEvidenceDigest: "b".repeat(64),
      reviewNote: "Test route Johannesburg, collection and simulated Paystack receipt checked independently",
    };
    const manualPending = await prepareStoreCheckoutCertification(store.id, ids.admins[0], manualProof);
    expect(manualPending.status).toBe("PENDING_REVIEW");
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[1], manualPending.revision, preflightOpts))
      .rejects.toMatchObject({ code: "CERTIFICATION_STALE" });

    // Preflight without any real published offer must also block preparation.
    await expect(
      prepareStoreCheckoutCertificationFromPreflight(store.id, ids.admins[0], undefined, preflightOpts),
    ).rejects.toMatchObject({ code: "PREFLIGHT_CAPABILITY_BLOCKED" });

    // Publish one real sellable courier-packaged offer, then certify from real-source preflight.
    const seeded = await seedRealPublishedOfferForProof({
      storeId: store.id,
      ownerId: owner.id,
      admin1Id: ids.admins[0],
      admin2Id: ids.admins[1],
      label: `t1-${label}`,
    });
    ids.cleanups.push(seeded.cleanup);

    const pending = await prepareStoreCheckoutCertificationFromPreflight(
      store.id,
      ids.admins[0],
      "Real-source checkout proof for independent review",
      preflightOpts,
    );
    expect(pending.status).toBe("PENDING_REVIEW");
    expect(pending.evidenceType).toBe("REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF");

    await expect(approveStoreCheckoutCertification(store.id, ids.admins[0], pending.revision, preflightOpts))
      .rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" } satisfies Partial<StoreCertificationError>);
    const approved = await approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision, preflightOpts);
    expect(approved.status).toBe("APPROVED");
    const certificate = await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(certificate.approvedByUserId).toBe(ids.admins[1]);
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[1], pending.revision, preflightOpts))
      .rejects.toMatchObject({ code: "CERTIFICATION_VERSION_CONFLICT" });

    // Recovery from expired/pre-digest approved evidence preserves account status while requiring fresh two-person proof.
    await prisma.storeCheckoutCertification.update({ where: { storeId: store.id }, data: {
      status: "APPROVED", routeEvidenceDigest: null, checkoutEvidenceDigest: null,
    } });
    const renewed = await prepareStoreCheckoutCertificationFromPreflight(
      store.id,
      ids.admins[0],
      "Renewal after legacy digest recovery",
      preflightOpts,
    );
    expect(renewed.status).toBe("PENDING_REVIEW");
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("ACTIVE");
    await expect(approveStoreCheckoutCertification(store.id, ids.admins[0], renewed.revision, preflightOpts))
      .rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });
    await approveStoreCheckoutCertification(store.id, ids.admins[1], renewed.revision, preflightOpts);
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("ACTIVE");
  });

  it("evaluates non-mutating CheckoutCapabilityPreflight, prepares deterministic certification without live charges, enforces distinct approval, and invalidates stale certification on pickup/policy change", async () => {
    const label = randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `preflight-owner-${label}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        phone: "+27820002222",
      },
    });
    const admin1 = await prisma.user.create({
      data: { email: `preflight-admin1-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const admin2 = await prisma.user.create({
      data: { email: `preflight-admin2-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    ids.admins.push(admin1.id, admin2.id);

    const store = await prisma.store.create({
      data: {
        name: "Preflight Merchant",
        slug: `preflight-${label}`,
        ownerUserId: owner.id,
        status: "ACTIVE",
        contactEmail: owner.email,
        contactPhone: "+27820002222",
      },
    });
    let cleanupOffer: (() => Promise<void>) | undefined;

    try {
      const preflightOpts = {
        coordinateResolver: async () => ({ latitude: -26.2041, longitude: 28.0473 }),
        zoneChecker: async () => ({
          matched: true,
          regionId: "isolated-covered-jhb",
          regionName: "Johannesburg",
          withinMaxDistance: true,
          warningMessage: null,
          calculationType: "geometric_haversine" as const,
        }),
        routeCalculator: async () => ({
          ok: true as const,
          route: {
            distanceMeters: 4200,
            durationSeconds: 780,
            routeSummary: "4.2 km · ~13 min",
            provider: "e2e_deterministic" as const,
          },
        }),
        serviceCatalogLoader: async () => [
          {
            id: "service-1",
            key: "STANDARD",
            name: "Standard",
            description: "1-2 business days",
            active: true,
            version: 1,
            provinces: ["Gauteng"],
            regionIds: ["isolated-covered-jhb"],
            baseFee: 129,
            perKmRate: 0,
            minFee: 129,
            maxFee: 249,
            estimatedDaysMin: 1,
            estimatedDaysMax: 2,
          },
        ],
        commissionChecker: async () => ({
          ready: true,
          status: "READY" as const,
          planId: "plan-1",
          planReference: "CPL-PREFLIGHT-1",
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

      // PAR-37: Incomplete store missing pickup and seller identity reports exact blocker codes
      const incomplete = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
      expect(incomplete?.preflightReady).toBe(false);
      expect(incomplete?.capabilityBlockers).toEqual(
        expect.arrayContaining([
          "MISSING_STREET",
          "MISSING_SUBURB",
          "MISSING_POSTCODE",
          "MISSING_MAP_PROOF",
          "UNAPPROVED_SELLER",
        ]),
      );
      await expect(
        prepareStoreCheckoutCertificationFromPreflight(
          store.id,
          admin1.id,
          undefined,
          preflightOpts,
        ),
      ).rejects.toMatchObject({ code: "PREFLIGHT_CAPABILITY_BLOCKED" });

      // Add complete pickup, approved seller identity, and active operational policy
      const pickup = await prisma.address.create({
        data: {
          storeId: store.id,
          type: "PICKUP",
          isDefault: true,
          line1: "22 Preflight Road",
          line2: "Sandton",
          city: "Johannesburg",
          province: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          latitude: "-26.2041000",
          longitude: "28.0473000",
          placeId: "place_preflight_1",
        },
      });
      await prisma.store.update({
        where: { id: store.id },
        data: { defaultPickupAddressId: pickup.id },
      });
      await prisma.storeSellerLegalIdentity.create({
        data: {
          storeId: store.id,
          publicReference: `SID-PRE-${label}`,
          identityVersion: "PAMMY_BAKES_V1",
          legalName: "Pammy Sole Trader",
          tradingName: "Pammy Bakes",
          vatRegistrationStatus: "NOT_REGISTERED",
          invoiceClassification: "RECEIPT",
          status: "APPROVED",
          effectiveFrom: new Date(Date.now() - 60_000),
          effectiveUntil: null,
        },
      });
      const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
        where: {
          status: "ACTIVE",
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        },
      });
      if (!existingPolicy) {
        await prisma.storeOrderOperationalPolicy.create({
          data: {
            publicReference: `SOP-PRE-${label}`,
            name: `preflight-policy-${label}`,
            versionNumber: 1,
            status: "ACTIVE",
            acceptanceWindowSeconds: 900,
            customerDecisionWindowSeconds: 900,
            maximumPrepMinutes: 60,
            maximumPrepExtensionMinutes: 30,
            maximumIssueCount: 3,
            maximumSubstitutionProposalsPerLine: 2,
            effectiveFrom: new Date(Date.now() - 60_000),
            effectiveUntil: null,
            approvedByUserId: admin1.id,
            activatedAt: new Date(),
          },
        });
      }
      await ensureAllParcelProfiles(admin1.id);
      await ensureActiveStoreCommissionPlan(store.id, admin1.id, admin2.id);

      // Seed one real published sellable courier-packaged offer so V-003 preflight passes.
      const seededOffer = await seedRealPublishedOfferForProof({
        storeId: store.id,
        ownerId: owner.id,
        admin1Id: admin1.id,
        admin2Id: admin2.id,
        label: `t2-${label}`,
      });
      cleanupOffer = seededOffer.cleanup;

      // PAR-38: Store with complete pickup, seller approval, route, service, policy, and sellable offer prepares preflight and gets distinct approval
      const readyPreflight = await evaluateStoreCheckoutCapabilityPreflight(
        store.id,
        preflightOpts,
      );
      expect(readyPreflight?.preflightReady).toBe(true);
      expect(readyPreflight?.capabilityBlockers).toEqual([]);
      expect(readyPreflight?.generatedEvidence?.routeEvidenceReference).toMatch(
        /^preflight-route:/,
      );
      expect(readyPreflight?.generatedEvidence?.checkoutEvidenceReference).toMatch(
        /^preflight-checkout:/,
      );

      const prepared = await prepareStoreCheckoutCertificationFromPreflight(
        store.id,
        admin1.id,
        undefined,
        preflightOpts,
      );
      expect(prepared.status).toBe("PENDING_REVIEW");
      expect(prepared.evidenceType).toBe("REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF");

      // Self-approval blocked
      await expect(
        approveStoreCheckoutCertification(store.id, admin1.id, prepared.revision, preflightOpts),
      ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });

      // Distinct reviewer approves
      const approved = await approveStoreCheckoutCertification(
        store.id,
        admin2.id,
        prepared.revision,
        preflightOpts,
      );
      expect(approved.status).toBe("APPROVED");

      // PAR-39: Changing pickup or policy after certification marks CERTIFICATION_STALE and revokes certification on revalidation
      await prisma.address.update({
        where: { id: pickup.id },
        data: { line1: "99 Changed Collection Street" },
      });
      const staleCheck = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
      expect(staleCheck?.blockers).toContain("CERTIFICATION_STALE");
      expect(staleCheck?.independentReviewerStatus).toBe("STALE_OR_EXPIRED");

      const revalidated = await revalidateStoreCheckoutCertification(
        store.id,
        admin2.id,
        preflightOpts,
      );
      expect(revalidated.valid).toBe(false);
      expect(revalidated.revoked).toBe(true);
      expect(revalidated.independentReviewerStatus).toBe("REVOKED");
    } finally {
      await cleanupOffer?.();
    }
  });
});
