import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getGlobalCommercePolicyRevision } from "@/lib/admin/commerce-readiness-revision";
import { selectStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
import {
  isStoreOperationalPolicyEffective,
  isStorePubliclyCheckoutReady,
  isStoreSellerIdentityEffective,
} from "@/lib/storefront/store-publication-readiness";

/** Builds the privacy-minimised store read projection. Store contact/address fields are intentionally absent. */
export async function rebuildStorefrontStoreDocument(storeId: string, transaction?: Prisma.TransactionClient): Promise<void> {
  const work = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`);
    const store = await tx.store.findUnique({
      where: { id: storeId },
      select: { id: true, slug: true, name: true, status: true, commerceReadinessRevision: true, updatedAt: true, defaultPickupAddress: true, savedAddresses: { where: { type: "PICKUP" } } },
    });
    if (!store) return;

    const now = new Date();
    const txWithOptional = tx as unknown as {
      systemSetting?: { findUnique?: unknown };
      commissionPlan?: Prisma.TransactionClient["commissionPlan"];
      storeCatalogOffer?: Prisma.TransactionClient["storeCatalogOffer"];
    };
    const [documents, storeMedia, checkoutCertification, sellerIdentity, operationalPolicy, commissionPlan, globalPolicyRevision, sellableOfferCount] = await Promise.all([
      tx.$queryRaw<Array<{ categoryPublicReference: string; fulfilmentMode: string }>>`SELECT "categoryPublicReference", "fulfilmentMode" FROM "StorefrontProductDocument" WHERE "storeId" = ${store.id} AND "status" = 'ACTIVE'`,
      tx.catalogMediaAsset?.findMany
        ? tx.catalogMediaAsset.findMany({
            where: {
              ownerType: "STORE",
              ownerStoreId: store.id,
              status: "READY",
              privacyInspectionPassed: true,
              purpose: { in: ["STORE_LOGO", "STORE_HERO", "BRAND_LOGO"] },
            },
            select: { publicReference: true, purpose: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          })
        : Promise.resolve([]),
      tx.storeCheckoutCertification.findUnique({
        where: { storeId },
        select: {
          status: true, evidenceType: true, pickupAddressId: true, pickupFingerprint: true,
          preparedByUserId: true, approvedByUserId: true, approvedAt: true,
          expiresAt: true, routeEvidenceDigest: true, checkoutEvidenceDigest: true,
          engineProofDigest: true, proofOfferReference: true, proofPriceVersionReference: true,
          sourceCommerceReadinessRevision: true, globalPolicyRevision: true,
        },
      }),
      tx.storeSellerLegalIdentity?.findFirst
        ? tx.storeSellerLegalIdentity.findFirst({
            where: {
              storeId: store.id,
              status: "APPROVED",
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
            select: { status: true, effectiveFrom: true, effectiveUntil: true },
          })
        : Promise.resolve(null),
      tx.storeOrderOperationalPolicy?.findFirst
        ? tx.storeOrderOperationalPolicy.findFirst({
            where: {
              status: "ACTIVE",
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
            select: { status: true, effectiveFrom: true, effectiveUntil: true },
          })
        : Promise.resolve(null),
      txWithOptional.commissionPlan?.findFirst
        ? txWithOptional.commissionPlan.findFirst({
            where: {
              subjectType: "MARKETPLACE_STORE_ORDER",
              scopeKey: `STORE:${store.id}`,
              currency: "ZAR",
              status: "ACTIVE",
              approvedAt: { not: null },
              effectiveFrom: { lte: now },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      typeof txWithOptional.systemSetting?.findUnique === "function"
        ? getGlobalCommercePolicyRevision(tx)
        : Promise.resolve(0),
      typeof txWithOptional.storeCatalogOffer?.count === "function"
        ? txWithOptional.storeCatalogOffer.count({
            where: {
              storeId: store.id,
              status: "ACTIVE",
              publicationStatus: "PUBLISHED",
              currentPriceVersionId: { not: null },
              priceVersions: {
                some: {
                  status: "ACTIVE",
                  effectiveFrom: { lte: now },
                  OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
                },
              },
              OR: [
                { inventoryTrackingMode: "UNTRACKED" },
                {
                  inventoryItem: {
                    levels: {
                      some: {
                        available: { gte: 1 },
                        location: { status: "ACTIVE" },
                      },
                    },
                  },
                },
              ],
            },
          })
        : Promise.resolve(null),
    ]);

    const logoAsset = storeMedia.find((m) => m.purpose === "STORE_LOGO") ?? storeMedia.find((m) => m.purpose === "BRAND_LOGO");
    const heroAsset = storeMedia.find((m) => m.purpose === "STORE_HERO");

    const pickup = selectStorePickupAddress(store.id, store.defaultPickupAddress, store.savedAddresses);
    const effectiveDocumentsCount =
      sellableOfferCount === null ? documents.length : Math.min(documents.length, sellableOfferCount);
    const active = isStorePubliclyCheckoutReady({
      status: store.status,
      name: store.name,
      documentsCount: effectiveDocumentsCount,
      pickup,
      certification: checkoutCertification,
      hasApprovedSellerIdentity: isStoreSellerIdentityEffective(sellerIdentity, now),
      hasActiveOperationalPolicy: isStoreOperationalPolicyEffective(operationalPolicy, now),
      hasActiveCommissionPlan: Boolean(commissionPlan),
      storeCommerceReadinessRevision: store.commerceReadinessRevision ?? 0,
      currentGlobalPolicyRevision: globalPolicyRevision,
      now,
    });
    await tx.storefrontStoreDocument.upsert({
      where: { storeId },
      create: {
        storeId,
        storePublicReference: store.slug,
        slug: store.slug,
        name: store.name,
        logoMediaReference: logoAsset?.publicReference ?? null,
        heroMediaReference: heroAsset?.publicReference ?? null,
        publicCategoryCodes: [...new Set(documents.map((document) => document.categoryPublicReference))].sort(),
        fulfilmentModes: [...new Set(documents.map((document) => document.fulfilmentMode))].sort(),
        serviceAreaReferences: [],
        publicStatus: active ? "ACTIVE" : "INELIGIBLE",
        publishedOfferCount: documents.length,
        projectionVersion: 1,
        sourceUpdatedAt: store.updatedAt,
        indexedAt: new Date(),
      },
      update: {
        name: store.name,
        logoMediaReference: logoAsset?.publicReference ?? null,
        heroMediaReference: heroAsset?.publicReference ?? null,
        publicCategoryCodes: [...new Set(documents.map((document) => document.categoryPublicReference))].sort(),
        fulfilmentModes: [...new Set(documents.map((document) => document.fulfilmentMode))].sort(),
        serviceAreaReferences: [],
        publicStatus: active ? "ACTIVE" : "INELIGIBLE",
        publishedOfferCount: documents.length,
        sourceUpdatedAt: store.updatedAt,
        indexedAt: new Date(),
        projectionVersion: { increment: 1 },
      },
    });
    };
  if (transaction) await work(transaction);
  else await prisma.$transaction(work);
}

