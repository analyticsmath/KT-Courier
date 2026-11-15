import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import {
  submitStoreSellerIdentity,
  reviewStoreSellerIdentity,
} from "@/lib/services/store-seller-identity.service";
import { upsertStorePickupAddressForStore } from "@/lib/services/store-addresses.service";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import {
  moderateCatalogOffer,
  moderateCatalogProduct,
} from "@/lib/services/catalog-moderation.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import { postCatalogInventoryMovement } from "@/lib/services/catalog-inventory.service";
import {
  CatalogMediaIntakeService,
  PrismaCatalogMediaRepository,
} from "@/lib/services/catalog-media-intake.service";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";
import {
  activateCommissionPlan,
  approveCommissionPlan,
  createCommissionPlan,
  retireCommissionPlan,
  submitCommissionPlan,
} from "@/lib/services/commission-plan.service";
import {
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  prepareStoreCheckoutCertificationFromPreflight,
} from "@/lib/admin/store-checkout-certification.service";
import { runDisposableStoreCheckoutEngineProof } from "@/lib/admin/store-checkout-engine-proof.service";
import { isStorePubliclyCheckoutReady } from "@/lib/storefront/store-publication-readiness";
import {
  activePublicProductDocumentSql,
  activePublicStoreDocumentSql,
} from "@/lib/storefront/sql-store-publication";
import {
  actOnTrustedPackageVersion,
  listTrustedPackageVersions,
  saveTrustedPackageVersion,
} from "@/lib/marketplace-checkout/parcel-configuration.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";

describe("V-001 through V-004 vendor onboarding, real proof and public parity", { timeout: 90_000 }, () => {
  const createdStoreIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdTypeIds: string[] = [];
  const createdSettingKeys: string[] = [];
  const createdCommissionPlanIds: string[] = [];
  const createdOperationalPolicyIds: string[] = [];
  const createdParcelProfileIds: string[] = [];

  beforeAll(() => {
    requireDisposableStoreSettlementDatabase();
  });

  afterAll(async () => {
    for (const planId of createdCommissionPlanIds) {
      await prisma.commissionPlanStatusHistory.deleteMany({ where: { planId } }).catch(() => {});
      await prisma.commissionRule.deleteMany({ where: { planId } }).catch(() => {});
      await prisma.commissionPlan.deleteMany({ where: { id: planId } }).catch(() => {});
    }
    for (const storeId of createdStoreIds) {
      await prisma.adminActivityLog.deleteMany({ where: { entityId: storeId } }).catch(() => {});
      await prisma.storefrontProductDocument.deleteMany({ where: { storeId } }).catch(() => {});
      await prisma.storefrontStoreDocument.deleteMany({ where: { storeId } }).catch(() => {});
      await prisma.storeCheckoutCertification.deleteMany({ where: { storeId } }).catch(() => {});
      await prisma.storeSellerLegalIdentity.deleteMany({ where: { storeId } }).catch(() => {});
      await prisma.store.updateMany({ where: { id: storeId }, data: { defaultPickupAddressId: null } }).catch(() => {});
      await prisma.address.deleteMany({ where: { storeId } }).catch(() => {});
    }
    if (createdSettingKeys.length) {
      await prisma.systemSetting.deleteMany({ where: { key: { in: createdSettingKeys } } }).catch(() => {});
    }
    if (createdParcelProfileIds.length) {
      await prisma.parcelProfileVersion.deleteMany({ where: { id: { in: createdParcelProfileIds } } }).catch(() => {});
    }
    if (createdOperationalPolicyIds.length) {
      await prisma.storeOrderOperationalPolicy.deleteMany({ where: { id: { in: createdOperationalPolicyIds } } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  function buildPreflightOpts(regionId: string) {
    return {
      coordinateResolver: async () => ({ latitude: -26.2041, longitude: 28.0473 }),
      zoneChecker: async () => ({
        matched: true,
        regionId,
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
          id: `svc-${regionId}`,
          key: "STANDARD",
          name: "Standard",
          description: "1-2 business days",
          active: true,
          version: 1,
          provinces: ["Gauteng"],
          regionIds: [regionId],
          baseFee: 129,
          perKmRate: 0,
          minFee: 129,
          maxFee: 249,
          estimatedDaysMin: 1,
          estimatedDaysMax: 2,
        },
      ],
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
  }

  async function ensureBaselineLogisticsAndPolicy(adminId: string, label: string) {
    const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({
      where: {
        status: "ACTIVE",
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
    });
    if (!existingPolicy) {
      const policy = await prisma.storeOrderOperationalPolicy.create({
        data: {
          publicReference: `SOP-V001-${label}`,
          name: `v001-policy-${label}`,
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
          approvedByUserId: adminId,
          activatedAt: new Date(),
        },
      });
      createdOperationalPolicyIds.push(policy.id);
    }

    const specs = [
      { key: "SMALL", l: 30, w: 20, h: 10, kg: 5 },
      { key: "MEDIUM", l: 45, w: 35, h: 25, kg: 15 },
      { key: "LARGE", l: 70, w: 50, h: 40, kg: 30 },
    ] as const;
    for (const s of specs) {
      const count = await prisma.parcelProfileVersion.count({
        where: {
          stableKey: s.key,
          status: "ACTIVE",
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      });
      if (count === 0) {
        const p = await prisma.parcelProfileVersion.create({
          data: {
            stableKey: s.key,
            displayName: `${s.key} Parcel`,
            versionNumber: 1,
            status: "ACTIVE",
            lengthCm: s.l,
            widthCm: s.w,
            heightCm: s.h,
            maximumWeightKg: s.kg,
            effectiveFrom: new Date(Date.now() - 60_000),
            effectiveTo: null,
            createdByUserId: adminId,
          },
        });
        createdParcelProfileIds.push(p.id);
      }
    }
  }

  it("V-001 & V-002: breaks onboarding deadlock without allowing zero-product live publication", async () => {
    const tag = randomUUID().slice(0, 8);
    const owner = await prisma.user.create({
      data: {
        email: `v001-owner-${tag}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        name: "Pammy Owner",
        phone: "+27821112222",
      },
    });
    const admin1 = await prisma.user.create({
      data: {
        email: `v001-admin1-${tag}@example.test`,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const admin2 = await prisma.user.create({
      data: {
        email: `v001-admin2-${tag}@example.test`,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    createdUserIds.push(owner.id, admin1.id, admin2.id);

    const store = await prisma.store.create({
      data: {
        ownerUserId: owner.id,
        name: `Pammy Bakes ${tag}`,
        slug: `pammy-bakes-${tag}`,
        status: "PENDING",
        contactEmail: owner.email,
        contactPhone: "+27821112222",
      },
    });
    createdStoreIds.push(store.id);

    const pmoRef = `PMO-${randomUUID()}`;
    await prisma.privateMediaObject.create({
      data: {
        publicReference: pmoRef,
        ownerType: "STORE",
        ownerId: store.id,
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
        storageProvider: "local-disposable-test",
        storageKey: `seller-verification/${store.id}/${pmoRef}.png`,
        originalFileName: "id.png",
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 128,
        checksum: "a".repeat(64),
        createdByUserId: owner.id,
      },
    });

    // V-001: Unregistered sole trader submits seller identity & admin approves WHILE Store.status === "PENDING"
    const identityProposal = await submitStoreSellerIdentity(store.id, owner.id, {
      operationId: randomUUID(),
      expectedIdentityReference: null,
      identityVersion: `v1-${tag}`,
      legalName: "Pammy Sole Trader",
      tradingName: `Pammy Bakes ${tag}`,
      vatRegistrationStatus: "NOT_REGISTERED",
      countryCode: "ZA",
      invoiceClassification: "RECEIPT",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      effectiveUntil: null,
      sourceEvidenceReference: pmoRef,
      confirmSuppliedDetails: true,
    });
    const identityReview = await reviewStoreSellerIdentity(store.id, admin1.id, {
      proposalReference: identityProposal.reference,
      expectedUpdatedAt: identityProposal.updatedAt,
      operationId: randomUUID(),
      action: "APPROVE",
      reason: "Verified sole trader identity and uploaded evidence",
      evidenceReference: pmoRef,
      confirmIndependentReview: true,
    });
    expect(identityReview.status).toBe("APPROVED");

    // V-001: Eligible PENDING store prepares stock location while awaiting Business Account approval
    const location = await createStoreInventoryLocation(store.id, owner.id, {
      name: "Main Bakery Kitchen",
      operationId: randomUUID(),
    });
    expect(location.status).toBe("ACTIVE");

    // V-002: Admin approves Business Account ONLY with verified owner + reachable contact (no pickup/cert required)
    const activated = await setStoreStatus(store.id, "ACTIVE", {
      actorUserId: admin1.id,
      reason: "Verified merchant owner and contact details",
    });
    expect(activated.status).toBe("ACTIVE");

    // Public shop remains strictly CLOSED before pickup, offer, and real certification
    const publicDocs = await prisma.$queryRaw<{ storePublicReference: string }[]>(
      Prisma.sql`SELECT "storePublicReference" FROM "StorefrontStoreDocument" WHERE "storeId" = ${store.id} AND ${activePublicStoreDocumentSql}`,
    );
    expect(publicDocs).toHaveLength(0);
  });

  it("V-003 & V-004: rejects zero-offer synthetic proof, certifies real published offer cleanly, and enforces public/revocation parity", async () => {
    const tag = randomUUID().slice(0, 8);
    const owner = await prisma.user.create({
      data: {
        email: `v003-owner-${tag}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        name: "Real Proof Owner",
        phone: "+27823334444",
      },
    });
    const admin1 = await prisma.user.create({
      data: {
        email: `v003-admin1-${tag}@example.test`,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const admin2 = await prisma.user.create({
      data: {
        email: `v003-admin2-${tag}@example.test`,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    createdUserIds.push(owner.id, admin1.id, admin2.id);

    await ensureBaselineLogisticsAndPolicy(admin1.id, tag);

    const store = await prisma.store.create({
      data: {
        ownerUserId: owner.id,
        name: `Real Proof Shop ${tag}`,
        slug: `real-proof-shop-${tag}`,
        status: "PENDING",
        contactEmail: owner.email,
        contactPhone: "+27823334444",
      },
    });
    createdStoreIds.push(store.id);

    await setStoreStatus(store.id, "ACTIVE", {
      actorUserId: admin1.id,
      reason: "Account verified before catalog preparation",
    });

    const pmoRef = `PMO-${randomUUID()}`;
    await prisma.privateMediaObject.create({
      data: {
        publicReference: pmoRef,
        ownerType: "STORE",
        ownerId: store.id,
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
        storageProvider: "local-disposable-test",
        storageKey: `seller-verification/${store.id}/${pmoRef}.png`,
        originalFileName: "id.png",
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 128,
        checksum: "b".repeat(64),
        createdByUserId: owner.id,
      },
    });
    const idProp = await submitStoreSellerIdentity(store.id, owner.id, {
      operationId: randomUUID(),
      expectedIdentityReference: null,
      identityVersion: `v1-${tag}`,
      legalName: "Real Proof Owner",
      tradingName: store.name,
      vatRegistrationStatus: "NOT_REGISTERED",
      countryCode: "ZA",
      invoiceClassification: "RECEIPT",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      effectiveUntil: null,
      sourceEvidenceReference: pmoRef,
      confirmSuppliedDetails: true,
    });
    await reviewStoreSellerIdentity(store.id, admin1.id, {
      proposalReference: idProp.reference,
      expectedUpdatedAt: idProp.updatedAt,
      operationId: randomUUID(),
      action: "APPROVE",
      reason: "Verified sole trader identity",
      evidenceReference: pmoRef,
      confirmIndependentReview: true,
    });

    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "15 Main Road",
      line2: "Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
      placeId: `place_${tag}`,
      contactName: "Real Proof Owner",
      contactPhone: "+27823334444",
    });
    // Saving first pickup address must NOT knock an ACTIVE account back to PENDING
    expect((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("ACTIVE");

    const plan = await createCommissionPlan({
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${store.id}`,
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      calculationVersion: "v003-plan",
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
    createdCommissionPlanIds.push(plan.id);
    await submitCommissionPlan(plan.id, admin1.id, randomUUID());
    await approveCommissionPlan(plan.id, admin2.id, randomUUID());
    await activateCommissionPlan(plan.id, admin2.id, randomUUID());

    const regionId = `v003-region-${tag}`;
    const preflightOpts = buildPreflightOpts(regionId);

    // V-003 negative check: 0 published sellable offers MUST fail preflight & engine proof
    const emptyPreflight = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
    expect(emptyPreflight?.preflightReady).toBe(false);
    expect(emptyPreflight?.capabilityBlockers).toContain("NO_SELLABLE_OFFER");
    await expect(
      prepareStoreCheckoutCertificationFromPreflight(store.id, admin1.id, "Zero offer attempt", preflightOpts),
    ).rejects.toMatchObject({ code: "PREFLIGHT_CAPABILITY_BLOCKED" });
    await expect(
      runDisposableStoreCheckoutEngineProof({
        storeId: store.id,
        pickupAddressId: (await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).defaultPickupAddressId!,
        coverageRegionId: regionId,
        coverageRegionName: "Johannesburg",
        routeDistanceMeters: 4200,
        routeSummary: "4.2 km",
        serviceKey: "STANDARD",
        serviceName: "Standard",
        serviceVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NO_SELLABLE_OFFER" });

    // Create, moderate, package & publish ONE real sellable offer
    const category = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `Category ${tag}`,
        slug: `cat-${tag}`,
        path: `/cat-${tag}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    createdCategoryIds.push(category.id);

    const definition = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `TYPE_${tag.toUpperCase()}`,
        name: `Product Type ${tag}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: { attributes: [] },
        variantSchema: {},
        complianceSchema: { requirements: [] },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });
    createdTypeIds.push(definition.id);

    const location = await createStoreInventoryLocation(store.id, owner.id, {
      name: "Bakehouse Stockroom",
      operationId: randomUUID(),
    });
    const intake = new CatalogMediaIntakeService(
      new PrismaCatalogMediaRepository(),
      new DeterministicCatalogMediaStorageAdapter(),
    );
    const bytes = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 80, g: 120, b: 160 } },
    })
      .png()
      .toBuffer();
    const intent = await intake.createUploadIntent({
      actorUserId: owner.id,
      ownerType: "STORE",
      storeId: store.id,
      purpose: "PRODUCT_IMAGE",
      declaredMimeType: "image/png",
      declaredByteSize: bytes.length,
      operationId: randomUUID(),
    });
    await intake.receiveUploadBytes({
      actorUserId: owner.id,
      storeId: store.id,
      uploadReference: intent.upload.publicReference,
      operationId: randomUUID(),
      bytes,
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
        productTypeDefinitionId: definition.id,
        primaryCategoryId: category.id,
        title: `Artisan Sourdough ${tag}`,
        description: "Real sellable product for capability proof.",
        condition: "NEW",
        attributeValues: {},
        complianceValues: {},
      },
      variants: [],
      storeSku: `SOUR-${tag}`,
      price: {
        amount: "75.00",
        currency: "ZAR",
        priceIncludesTax: false,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      },
      openingStock: 5,
      inventoryLocationPublicReference: location.publicReference,
      packaging: {
        lengthCm: 20,
        widthCm: 15,
        heightCm: 10,
        weightKg: 0.8,
        description: "Wrapped loaf box",
      },
      modifiers: [],
      media: [
        {
          assetPublicReference: readyMedia.asset.publicReference,
          altText: "Artisan loaf",
          displayOrder: 0,
          primary: true,
          variantAssociation: "PRODUCT",
        },
      ],
    });
    const offerRef = draft.offers[0]!.publicReference;
    createdSettingKeys.push(`${PACKAGING_PREFIX}${offerRef}`);

    const submittedProduct = await submitStoreCatalogProduct(store.id, draft.publicReference, owner.id, {
      version: draft.version,
      operationId: randomUUID(),
    });
    const approvedProduct = await moderateCatalogProduct(submittedProduct.id, admin1.id, "APPROVE", {
      version: submittedProduct.version,
      operationId: randomUUID(),
      reasonCode: "V003_PRODUCT_APPROVAL",
    });
    const submittedOffer = await transitionStoreCatalogOffer(store.id, offerRef, owner.id, "SUBMITTED", {
      version: draft.offers[0]!.version,
      operationId: randomUUID(),
    });
    const approvedOffer = await moderateCatalogOffer(submittedOffer.id, admin1.id, "APPROVE", {
      version: submittedOffer.version,
      operationId: randomUUID(),
      reasonCode: "V003_OFFER_APPROVAL",
    });
    const published = await publishApprovedCatalogListing(approvedOffer.id, admin2.id, {
      version: approvedOffer.version,
      productVersion: approvedProduct.version,
      priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
      operationId: randomUUID(),
      reasonCode: "V003_PUBLICATION",
    });
    expect(published.offer.publicationStatus).toBe("PUBLISHED");

    // Approve trusted packaging for this published courier offer
    const pkgSetting = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: `${PACKAGING_PREFIX}${offerRef}` },
    });
    const pkgRevision = (pkgSetting.value as { revision: string }).revision;
    const versions = await listTrustedPackageVersions();
    const activePkgVersion = versions.filter((v) => v.status === "ACTIVE").sort((a, b) => b.version - a.version)[0];
    const latestPkgVersion = Math.max(0, ...versions.map((v) => v.version));
    const variantRef = draft.variants[0]!.publicReference;
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
    createdSettingKeys.push(`production_marketplace_trusted_packages_v${savedPkg.version}`);
    const pkgRow = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: `production_marketplace_trusted_packages_v${savedPkg.version}` },
    });
    const approvedPkg = await actOnTrustedPackageVersion(admin2.id, {
      version: savedPkg.version,
      expectedUpdatedAt: pkgRow.updatedAt.toISOString(),
      action: "APPROVE",
      reason: "Independent packaging measurement verification",
    });
    const pkgRow2 = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: `production_marketplace_trusted_packages_v${savedPkg.version}` },
    });
    await actOnTrustedPackageVersion(admin2.id, {
      version: savedPkg.version,
      expectedUpdatedAt: pkgRow2.updatedAt.toISOString(),
      action: "ACTIVATE",
      reason: `Activate packaging v${approvedPkg.version}`,
    });

    // Record baseline financial counts before proof
    const orderCountBefore = await prisma.marketplaceOrder.count();
    const paymentCountBefore = await prisma.payment.count();

    // Now real-source preflight & certification prepare + distinct approve MUST succeed
    const readyPreflight = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
    expect(readyPreflight?.preflightReady).toBe(true);
    const prepared = await prepareStoreCheckoutCertificationFromPreflight(
      store.id,
      admin1.id,
      "Real source-backed capability proof",
      preflightOpts,
    );
    expect(prepared.evidenceType).toBe("REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF");
    expect((prepared as { proofOfferReference?: string | null }).proofOfferReference).toBe(offerRef);

    // Zero residual commercial rows created by proof
    expect(await prisma.marketplaceOrder.count()).toBe(orderCountBefore);
    expect(await prisma.payment.count()).toBe(paymentCountBefore);

    await approveStoreCheckoutCertification(store.id, admin2.id, prepared.revision, preflightOpts);

    // Public SQL visibility and JS readiness MUST agree and now be LIVE
    const visibleStoreDocs = await prisma.$queryRaw<{ storePublicReference: string }[]>(
      Prisma.sql`SELECT "storePublicReference" FROM "StorefrontStoreDocument" WHERE "storeId" = ${store.id} AND "publicStatus" = 'ACTIVE' AND ${activePublicStoreDocumentSql}`,
    );
    expect(visibleStoreDocs).toHaveLength(1);
    const visibleProductDocs = await prisma.$queryRaw<{ offerPublicReference: string }[]>(
      Prisma.sql`SELECT "offerPublicReference" FROM "StorefrontProductDocument" WHERE "storeId" = ${store.id} AND "status" = 'ACTIVE' AND ${activePublicProductDocumentSql}`,
    );
    expect(visibleProductDocs).toHaveLength(1);

    // Contact-only pickup update must preserve SELLING_LIVE
    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "15 Main Road",
      line2: "Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
      placeId: `place_${tag}`,
      contactName: "Updated Dispatch Desk",
      contactPhone: "+27829998888",
    });
    const afterContactDocs = await prisma.$queryRaw<{ storePublicReference: string }[]>(
      Prisma.sql`SELECT "storePublicReference" FROM "StorefrontStoreDocument" WHERE "storeId" = ${store.id} AND "publicStatus" = 'ACTIVE' AND ${activePublicStoreDocumentSql}`,
    );
    expect(afterContactDocs).toHaveLength(1);

    // Retiring store commission plan MUST immediately hide store from public SQL (V-004 parity)
    await retireCommissionPlan(plan.id, admin2.id, randomUUID());
    const afterCommissionRetiredDocs = await prisma.$queryRaw<{ storePublicReference: string }[]>(
      Prisma.sql`SELECT "storePublicReference" FROM "StorefrontStoreDocument" WHERE "storeId" = ${store.id} AND "publicStatus" = 'ACTIVE' AND ${activePublicStoreDocumentSql}`,
    );
    expect(afterCommissionRetiredDocs).toHaveLength(0);

    // Reactivate a fresh commission plan + recertify or test zero stock + moved pin:
    const plan2 = await createCommissionPlan({
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${store.id}`,
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      calculationVersion: "v004-plan-2",
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
    createdCommissionPlanIds.push(plan2.id);
    await submitCommissionPlan(plan2.id, admin1.id, randomUUID());
    await approveCommissionPlan(plan2.id, admin2.id, randomUUID());
    await activateCommissionPlan(plan2.id, admin2.id, randomUUID());

    // Zeroing stock on only sellable offer MUST immediately hide store from public SQL & preflight
    const invItem = await prisma.catalogInventoryItem.findUniqueOrThrow({
      where: { offerId: approvedOffer.id },
    });
    await postCatalogInventoryMovement(store.id, owner.id, invItem.publicReference, {
      locationPublicReference: location.publicReference,
      type: "STOCK_COUNT_CORRECTION",
      quantityDelta: -5,
      operationId: randomUUID(),
      reasonCode: "OUT_OF_STOCK_CHECK",
      version: invItem.version,
    });
    const afterZeroStockDocs = await prisma.$queryRaw<{ storePublicReference: string }[]>(
      Prisma.sql`SELECT "storePublicReference" FROM "StorefrontStoreDocument" WHERE "storeId" = ${store.id} AND "publicStatus" = 'ACTIVE' AND ${activePublicStoreDocumentSql}`,
    );
    expect(afterZeroStockDocs).toHaveLength(0);

    // Moved pickup address revokes live cert while preserving Account Approval (Store.status === "ACTIVE")
    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "99 Moved Street",
      line2: "Rosebank",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.1467,
      longitude: 28.0416,
      placeId: `place_moved_${tag}`,
      contactName: "Updated Dispatch Desk",
      contactPhone: "+27829998888",
    });
    const storeAfterMove = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(storeAfterMove.status).toBe("ACTIVE");
    const certAfterMove = await prisma.storeCheckoutCertification.findFirstOrThrow({
      where: { storeId: store.id },
      orderBy: { revision: "desc" },
    });
    expect(certAfterMove.status).toBe("REVOKED");
    const readyAfterMove = isStorePubliclyCheckoutReady({
      status: storeAfterMove.status,
      name: storeAfterMove.name,
      documentsCount: 1,
      pickup: {
        id: storeAfterMove.defaultPickupAddressId!,
        storeId: store.id,
        type: "PICKUP",
        line1: "99 Moved Street",
        line2: "Rosebank",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        placeId: `place_moved_${tag}`,
        latitude: -26.1467,
        longitude: 28.0416,
      },
      certification: certAfterMove,
      hasApprovedSellerIdentity: true,
      hasActiveOperationalPolicy: true,
      hasActiveCommissionPlan: true,
      storeCommerceReadinessRevision: storeAfterMove.commerceReadinessRevision,
      currentGlobalPolicyRevision: await prisma.systemSetting
        .findUnique({ where: { key: "platform.commerce_readiness_revision" }, select: { value: true } })
        .then((row) => ((row?.value as { version?: number } | null)?.version ?? 1)),
    });
    expect(readyAfterMove).toBe(false);
  });

  it("V-003 strict gate: refuses prepareStoreCheckoutCertificationFromPreflight on a zero-offer ACTIVE store (no SAVEPOINT_SYNTHETIC bypass)", async () => {
    const tag = randomUUID().slice(0, 8);
    const owner = await prisma.user.create({
      data: {
        email: `v003-zero-owner-${tag}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        phone: "+27824445555",
      },
    });
    const admin1 = await prisma.user.create({
      data: { email: `v003-zero-adm1-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const admin2 = await prisma.user.create({
      data: { email: `v003-zero-adm2-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    createdUserIds.push(owner.id, admin1.id, admin2.id);
    await ensureBaselineLogisticsAndPolicy(admin1.id, `z-${tag}`);

    const store = await prisma.store.create({
      data: {
        ownerUserId: owner.id,
        name: `Zero Offer Shop ${tag}`,
        slug: `zero-offer-${tag}`,
        status: "ACTIVE",
        contactEmail: owner.email,
        contactPhone: "+27824445555",
      },
    });
    createdStoreIds.push(store.id);

    const pmoRef = `PMO-${randomUUID()}`;
    await prisma.privateMediaObject.create({
      data: {
        publicReference: pmoRef,
        ownerType: "STORE",
        ownerId: store.id,
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
        storageProvider: "local-disposable-test",
        storageKey: `seller-verification/${store.id}/${pmoRef}.png`,
        originalFileName: "id.png",
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 128,
        checksum: "c".repeat(64),
        createdByUserId: owner.id,
      },
    });
    const idProp = await submitStoreSellerIdentity(store.id, owner.id, {
      operationId: randomUUID(),
      expectedIdentityReference: null,
      identityVersion: `v1-${tag}`,
      legalName: "Zero Offer Owner",
      tradingName: store.name,
      vatRegistrationStatus: "NOT_REGISTERED",
      countryCode: "ZA",
      invoiceClassification: "RECEIPT",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      effectiveUntil: null,
      sourceEvidenceReference: pmoRef,
      confirmSuppliedDetails: true,
    });
    await reviewStoreSellerIdentity(store.id, admin1.id, {
      proposalReference: idProp.reference,
      expectedUpdatedAt: idProp.updatedAt,
      operationId: randomUUID(),
      action: "APPROVE",
      reason: "Verified sole trader identity",
      evidenceReference: pmoRef,
      confirmIndependentReview: true,
    });
    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "22 Zero Offer Road",
      line2: "Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
      placeId: `place_zero_${tag}`,
      contactName: "Zero Offer Owner",
      contactPhone: "+27824445555",
    });
    const plan = await createCommissionPlan({
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${store.id}`,
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      calculationVersion: "v003-zero-plan",
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
    createdCommissionPlanIds.push(plan.id);
    await submitCommissionPlan(plan.id, admin1.id, randomUUID());
    await approveCommissionPlan(plan.id, admin2.id, randomUUID());
    await activateCommissionPlan(plan.id, admin2.id, randomUUID());

    const opts = buildPreflightOpts(`v003-zero-${tag}`);
    const preflight = await evaluateStoreCheckoutCapabilityPreflight(store.id, opts);
    expect(preflight?.preflightReady).toBe(false);
    expect(preflight?.capabilityBlockers).toContain("NO_SELLABLE_OFFER");
    await expect(
      prepareStoreCheckoutCertificationFromPreflight(store.id, admin1.id, "Zero offer attempt", opts),
    ).rejects.toMatchObject({ code: "PREFLIGHT_CAPABILITY_BLOCKED" });
  });

  it("V-004 live catalog expansion & paid-order drift safety: publishes 2nd product without recertifying, and drift revocation preserves existing paid orders", async () => {
    const tag = randomUUID().slice(0, 8);
    const customer = await prisma.user.create({
      data: {
        email: `v004-cust-${tag}@example.test`,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: `v004-own-${tag}@example.test`,
        role: "STORE",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        name: "Live Expansion Owner",
        phone: "+27825556666",
      },
    });
    const admin1 = await prisma.user.create({
      data: { email: `v004-adm1-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const admin2 = await prisma.user.create({
      data: { email: `v004-adm2-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    createdUserIds.push(customer.id, owner.id, admin1.id, admin2.id);
    await ensureBaselineLogisticsAndPolicy(admin1.id, `exp-${tag}`);

    const store = await prisma.store.create({
      data: {
        ownerUserId: owner.id,
        name: `Live Expansion Shop ${tag}`,
        slug: `live-exp-${tag}`,
        status: "ACTIVE",
        contactEmail: owner.email,
        contactPhone: "+27825556666",
      },
    });
    createdStoreIds.push(store.id);

    const pmoRef = `PMO-${randomUUID()}`;
    await prisma.privateMediaObject.create({
      data: {
        publicReference: pmoRef,
        ownerType: "STORE",
        ownerId: store.id,
        purpose: "STORE_VERIFICATION_DOCUMENT",
        status: "READY",
        storageProvider: "local-disposable-test",
        storageKey: `seller-verification/${store.id}/${pmoRef}.png`,
        originalFileName: "id.png",
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 128,
        checksum: "d".repeat(64),
        createdByUserId: owner.id,
      },
    });
    const idProp = await submitStoreSellerIdentity(store.id, owner.id, {
      operationId: randomUUID(),
      expectedIdentityReference: null,
      identityVersion: `v1-${tag}`,
      legalName: "Live Expansion Sole Trader",
      tradingName: store.name,
      vatRegistrationStatus: "NOT_REGISTERED",
      countryCode: "ZA",
      invoiceClassification: "RECEIPT",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      effectiveUntil: null,
      sourceEvidenceReference: pmoRef,
      confirmSuppliedDetails: true,
    });
    await reviewStoreSellerIdentity(store.id, admin1.id, {
      proposalReference: idProp.reference,
      expectedUpdatedAt: idProp.updatedAt,
      operationId: randomUUID(),
      action: "APPROVE",
      reason: "Verified seller identity",
      evidenceReference: pmoRef,
      confirmIndependentReview: true,
    });
    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "33 Expansion Way",
      line2: "Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
      placeId: `place_exp_${tag}`,
      contactName: "Live Expansion Owner",
      contactPhone: "+27825556666",
    });
    const plan = await createCommissionPlan({
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${store.id}`,
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      calculationVersion: "v004-exp-plan",
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
    createdCommissionPlanIds.push(plan.id);
    await submitCommissionPlan(plan.id, admin1.id, randomUUID());
    await approveCommissionPlan(plan.id, admin2.id, randomUUID());
    await activateCommissionPlan(plan.id, admin2.id, randomUUID());

    const category = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `Exp Category ${tag}`,
        slug: `exp-cat-${tag}`,
        path: `/exp-cat-${tag}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    createdCategoryIds.push(category.id);
    const definition = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `EXP_TYPE_${tag.toUpperCase()}`,
        name: `Exp Type ${tag}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: { attributes: [] },
        variantSchema: {},
        complianceSchema: { requirements: [] },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });
    createdTypeIds.push(definition.id);
    const location = await createStoreInventoryLocation(store.id, owner.id, {
      name: "Expansion Dispatch Shelf",
      operationId: randomUUID(),
    });
    const intake = new CatalogMediaIntakeService(
      new PrismaCatalogMediaRepository(),
      new DeterministicCatalogMediaStorageAdapter(),
    );
    const pngBytes = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 90, g: 140, b: 120 } },
    })
      .png()
      .toBuffer();

    const publishProductOffer = async (index: number, title: string, amountZar: string) => {
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
          productTypeDefinitionId: definition.id,
          primaryCategoryId: category.id,
          title,
          description: `Live store product ${index}.`,
          condition: "NEW",
          attributeValues: {},
          complianceValues: {},
        },
        variants: [],
        storeSku: `EXP-${index}-${tag}`,
        price: {
          amount: amountZar,
          currency: "ZAR",
          priceIncludesTax: false,
          effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        },
        openingStock: 8,
        inventoryLocationPublicReference: location.publicReference,
        packaging: {
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10,
          weightKg: 0.9,
          description: `Packaging ${index}`,
        },
        modifiers: [],
        media: [
          {
            assetPublicReference: readyMedia.asset.publicReference,
            altText: title,
            displayOrder: 0,
            primary: true,
            variantAssociation: "PRODUCT",
          },
        ],
      });
      const offerRef = draft.offers[0]!.publicReference;
      createdSettingKeys.push(`${PACKAGING_PREFIX}${offerRef}`);
      const subProd = await submitStoreCatalogProduct(store.id, draft.publicReference, owner.id, {
        version: draft.version,
        operationId: randomUUID(),
      });
      const appProd = await moderateCatalogProduct(subProd.id, admin1.id, "APPROVE", {
        version: subProd.version,
        operationId: randomUUID(),
        reasonCode: "V004_EXP_PRODUCT_APPROVAL",
      });
      const subOffer = await transitionStoreCatalogOffer(store.id, offerRef, owner.id, "SUBMITTED", {
        version: draft.offers[0]!.version,
        operationId: randomUUID(),
      });
      const appOffer = await moderateCatalogOffer(subOffer.id, admin1.id, "APPROVE", {
        version: subOffer.version,
        operationId: randomUUID(),
        reasonCode: "V004_EXP_OFFER_APPROVAL",
      });
      const published = await publishApprovedCatalogListing(appOffer.id, admin2.id, {
        version: appOffer.version,
        productVersion: appProd.version,
        priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
        operationId: randomUUID(),
        reasonCode: "V004_EXP_PUBLICATION",
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
            variantReference: draft.variants[0]!.publicReference,
            publicationVersion: String(published.offer.version),
            modifiers: [],
            packingRule: "SINGLE_PREPACKAGED_UNIT",
            lengthCm: 20,
            widthCm: 15,
            heightCm: 10,
            weightKg: 0.9,
            authorityReference: `${PACKAGING_PREFIX}${offerRef}:${pkgRevision}`,
          },
        ],
        bundles: activePkgVersion?.bundles ?? [],
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
        effectiveTo: null,
        expectedVersion: latestPkgVersion,
        reason: `Trusted package for live product ${index}`,
      });
      createdSettingKeys.push(`production_marketplace_trusted_packages_v${savedPkg.version}`);
      const pkgRow = await prisma.systemSetting.findUniqueOrThrow({
        where: { key: `production_marketplace_trusted_packages_v${savedPkg.version}` },
      });
      const approvedPkg = await actOnTrustedPackageVersion(admin2.id, {
        version: savedPkg.version,
        expectedUpdatedAt: pkgRow.updatedAt.toISOString(),
        action: "APPROVE",
        reason: `Approve packaging ${index}`,
      });
      const pkgRow2 = await prisma.systemSetting.findUniqueOrThrow({
        where: { key: `production_marketplace_trusted_packages_v${savedPkg.version}` },
      });
      await actOnTrustedPackageVersion(admin2.id, {
        version: savedPkg.version,
        expectedUpdatedAt: pkgRow2.updatedAt.toISOString(),
        action: "ACTIVATE",
        reason: `Activate packaging v${approvedPkg.version}`,
      });
      return { offerRef, productRef: draft.publicReference };
    };

    // Publish 1st product & certify store to SELLING_LIVE
    await publishProductOffer(1, `Live Cake 1 ${tag}`, "110.00");
    const preflightOpts = buildPreflightOpts(`v004-exp-${tag}`);
    const prepared = await prepareStoreCheckoutCertificationFromPreflight(
      store.id,
      admin1.id,
      "Certify before 2nd product publication",
      preflightOpts,
    );
    await approveStoreCheckoutCertification(store.id, admin2.id, prepared.revision, preflightOpts);
    const certRevAfterFirst = (await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } })).revision;

    // Publish 2nd product while store is already SELLING_LIVE — no recertification required
    const second = await publishProductOffer(2, `Live Cake 2 ${tag}`, "145.00");
    const certAfterSecond = await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } });
    expect(certAfterSecond.status).toBe("APPROVED");
    expect(certAfterSecond.revision).toBe(certRevAfterFirst);
    const visibleProducts = await prisma.$queryRaw<{ offerPublicReference: string }[]>(
      Prisma.sql`SELECT "offerPublicReference" FROM "StorefrontProductDocument" WHERE "storeId" = ${store.id} AND "status" = 'ACTIVE' AND ${activePublicProductDocumentSql}`,
    );
    expect(visibleProducts.map((r) => r.offerPublicReference)).toEqual(
      expect.arrayContaining([second.offerRef]),
    );
    expect(visibleProducts).toHaveLength(2);

    // Record a paid confirmed marketplace order BEFORE drift revocation
    const marker = `paid-${tag}`;
    const cart = await prisma.marketplaceCart.create({
      data: { publicReference: `${marker}-cart`, ownerType: "CUSTOMER", customerUserId: customer.id, status: "CHECKOUT_LOCKED" },
    });
    const checkout = await prisma.marketplaceCheckout.create({
      data: {
        publicReference: `${marker}-checkout`,
        cartId: cart.id,
        customerUserId: customer.id,
        status: "COMPLETED",
        reviewVersion: 1,
        merchandiseSubtotal: "110.00",
        grandTotal: "110.00",
        digitalRequired: "110.00",
        commercialFingerprint: marker,
        acceptedFingerprint: marker,
        reviewAcceptedAt: new Date(),
      },
    });
    const group = await prisma.marketplaceCheckoutStoreGroup.create({
      data: {
        checkoutId: checkout.id,
        storeId: store.id,
        fulfilmentMode: "COURIER_DELIVERY",
        merchandiseSubtotal: "110.00",
        groupTotal: "110.00",
      },
    });
    const platformWallet = await ensureWalletForOwner({
      ownerType: "PLATFORM",
      ownerId: "platform",
      currency: "ZAR",
    });
    const assetAccount = await ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CASH-CLEARING-ZAR",
      purpose: "CASH_CLEARING",
      category: "ASSET",
      currency: "ZAR",
    });
    const heldAccount = await ensureLedgerAccount({
      walletId: platformWallet.id,
      code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
      purpose: "HELD",
      category: "LIABILITY",
      currency: "ZAR",
    });
    const receiptJournal = await postLedgerJournal({
      idempotencyKey: `${marker}-receipt-journal`,
      type: "EXTERNAL_PAYMENT_RECEIPT",
      currency: "ZAR",
      sourceReference: `V004_TEST:${marker.replaceAll("-", "_").toUpperCase()}`,
      correlationId: `PAY-${marker}`,
      actor: { kind: "SYSTEM" },
      entries: [
        { accountId: assetAccount.id, direction: "DEBIT", amount: "110.00", lineCode: "PROVIDER-ASSET" },
        { accountId: heldAccount.id, direction: "CREDIT", amount: "110.00", lineCode: "CUSTOMER-FUNDS-HELD" },
      ],
    });
    const payment = await prisma.payment.create({
      data: {
        publicReference: `PAY-${marker}`,
        userId: customer.id,
        marketplaceCheckoutId: checkout.id,
        subjectType: "MARKETPLACE_CHECKOUT",
        provider: "PAYSTACK",
        status: "PENDING",
        amount: "110.00",
        creationIdempotencyKey: `${marker}-pay`,
        creationRequestHash: "e".repeat(64),
      },
    });
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        provider: "PAYSTACK",
        idempotencyKey: `${marker}-attempt`,
        requestHash: "f".repeat(64),
        merchantReference: `${marker}-merchant`,
        status: "SUCCEEDED",
        amount: "110.00",
        currency: "ZAR",
        providerEnvironment: "SANDBOX",
        providerConfirmedAt: new Date(),
      },
    });
    const webhook = await prisma.paymentWebhookEvent.create({
      data: {
        publicReference: `pwe_${randomUUID().replaceAll("-", "")}`,
        provider: "PAYSTACK",
        environment: "SANDBOX",
        eventFingerprint: createHash("sha256").update(marker).digest("hex"),
        merchantReference: attempt.merchantReference,
        providerStatus: "success",
        normalizedStatus: "COMPLETE",
        processingStatus: "APPLIED",
        paymentId: payment.id,
        attemptId: attempt.id,
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: true,
        amountVerified: true,
        providerDataVerified: true,
        verifiedAt: new Date(),
        appliedAt: new Date(),
        ledgerJournalId: receiptJournal.id,
      },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        successfulAttemptId: attempt.id,
        successWebhookEventId: webhook.id,
        successLedgerJournalId: receiptJournal.id,
        providerConfirmedAt: new Date(),
        succeededAt: new Date(),
        version: { increment: 1 },
      },
    });
    const mktOrder = await prisma.marketplaceOrder.create({
      data: {
        publicReference: `${marker}-order`,
        checkoutId: checkout.id,
        paymentId: payment.id,
        customerUserId: customer.id,
        merchandiseSubtotal: "110.00",
        modifierSubtotal: "0.00",
        deliveryFeeTotal: "0.00",
        promotionDiscount: "0.00",
        grandTotal: "110.00",
        digitalRequired: "110.00",
        commercialFingerprint: marker,
        status: "CONFIRMED",
      },
    });
    const storeOrder = await prisma.marketplaceStoreOrder.create({
      data: {
        publicReference: `${marker}-store-order`,
        marketplaceOrderId: mktOrder.id,
        checkoutStoreGroupId: group.id,
        storeId: store.id,
        merchandiseSubtotal: "110.00",
        modifierSubtotal: "0.00",
        deliveryFee: "0.00",
        groupTotal: "110.00",
        status: "PENDING_STORE_REVIEW",
      },
    });

    // Drift: moving pickup revokes public discovery & cert, WITHOUT corrupting or cancelling existing paid orders
    await upsertStorePickupAddressForStore(store.id, owner.id, {
      line1: "88 Moved Drift Road",
      line2: "Rosebank",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      latitude: -26.1467,
      longitude: 28.0416,
      placeId: `place_exp_moved_${tag}`,
      contactName: "Live Expansion Owner",
      contactPhone: "+27825556666",
    });
    expect(await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: store.id } })).toMatchObject({
      publicStatus: "INELIGIBLE",
    });
    expect(await prisma.storeCheckoutCertification.findUniqueOrThrow({ where: { storeId: store.id } })).toMatchObject({
      status: "REVOKED",
    });
    expect(await prisma.marketplaceOrder.findUniqueOrThrow({ where: { id: mktOrder.id } })).toMatchObject({
      status: "CONFIRMED",
    });
    expect(await prisma.marketplaceStoreOrder.findUniqueOrThrow({ where: { id: storeOrder.id } })).toMatchObject({
      status: "PENDING_STORE_REVIEW",
    });
  });
});
