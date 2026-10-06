import { assertLegacyApplyAllowed } from "../../lib/migrations/legacy-6ammart/target-policy";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildCatalogPublicationSnapshot } from "../../lib/catalog/catalog-publication-snapshot";
import { deriveStorefrontAvailability } from "../../lib/storefront/storefront-availability-policy";
import { StorefrontProjectionService } from "../../lib/services/storefront-projection.service";
import { rebuildStorefrontStoreDocument } from "../../lib/services/storefront-store.service";
import { rebuildStorefrontCategoryDocument } from "../../lib/services/storefront-category.service";

const prisma = new PrismaClient();
const projectionService = new StorefrontProjectionService();

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const apply = hasFlag("--apply");

  if (apply) assertLegacyApplyAllowed();

  const fingerprintIndex = process.argv.indexOf("--source-fingerprint");
  const fingerprint = fingerprintIndex >= 0 ? process.argv[fingerprintIndex + 1] : undefined;
  if (!/^[a-f0-9]{64}$/.test(fingerprint ?? "")) throw new Error("--source-fingerprint is required.");
  const run = await prisma.legacyMigrationRun.findFirst({
    where: {
      sourceSystem: "LEGACY_6AMMART",
      sourceDatabase: "wwwktcouriers_ktcouaielidb",
      phase: "CATALOG_CORE",
      sourceFingerprint: fingerprint,
      status: { in: ["VALIDATED", "APPLIED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!run) {
    throw new Error("No validated legacy catalogue migration run exists.");
  }

  const publishMappings = await prisma.legacyMigrationMap.findMany({
    where: {
      runId: run.id,
      sourceTable: "items",
      targetModel: "CatalogProduct",
      disposition: "PUBLISH",
    },
    orderBy: { sourceId: "asc" },
  });

  let publishableOffers = 0;
  const blocked: Array<{ sourceId: string; reason: string }> = [];
  const plans: Array<{
    sourceId: string;
    productId: string;
    offerIds: string[];
  }> = [];

  for (const mapping of publishMappings) {
    const product = await prisma.catalogProduct.findUnique({
      where: { id: mapping.targetId },
      include: {
        primaryCategory: true,
        productTypeDefinition: true,
        brand: true,
        media: { include: { asset: true }, orderBy: { displayOrder: "asc" } },
        variants: {
          include: {
            offers: {
              include: {
                store: true,
                currentPriceVersion: true,
                inventoryItem: { include: { levels: true } },
              },
            },
          },
        },
      },
    });

    if (!product) {
      blocked.push({ sourceId: mapping.sourceId, reason: "PRODUCT_MISSING" });
      continue;
    }

    const primary = product.media.find(
      (media) =>
        media.role === "PRIMARY" &&
        media.variantId === null &&
        media.asset.status === "READY" &&
        media.asset.privacyInspectionPassed &&
        media.asset.width &&
        media.asset.height,
    );
    if (!primary) {
      blocked.push({ sourceId: mapping.sourceId, reason: "PRIMARY_MEDIA_NOT_READY" });
      continue;
    }

    const eligibleOfferIds: string[] = [];
    for (const variant of product.variants) {
      for (const offer of variant.offers) {
        const price = offer.currentPriceVersion;
        if (
          offer.store.status !== "ACTIVE" ||
          offer.status !== "ACTIVE" ||
          variant.status !== "ACTIVE" ||
          !price ||
          price.status !== "ACTIVE" ||
          price.currency !== "ZAR" ||
          !price.priceIncludesTax
        ) {
          continue;
        }

        if (offer.inventoryTrackingMode === "TRACKED") {
          const levels = offer.inventoryItem?.levels ?? [];
          if (levels.length < 1) continue;
        }

        eligibleOfferIds.push(offer.id);
      }
    }

    if (eligibleOfferIds.length === 0) {
      blocked.push({ sourceId: mapping.sourceId, reason: "NO_ELIGIBLE_OFFER" });
      continue;
    }

    plans.push({
      sourceId: mapping.sourceId,
      productId: product.id,
      offerIds: eligibleOfferIds,
    });
    publishableOffers += eligibleOfferIds.length;
  }

  const dryRun = {
    mode: apply ? "apply" : "dry-run",
    sourceProducts: publishMappings.length,
    publishableProducts: plans.length,
    publishableOffers,
    blocked,
  };

  if (!apply) {
    console.log(JSON.stringify(dryRun, null, 2));
    return;
  }

  if (blocked.length > 0) throw new Error("Publication blocked for " + blocked.length + " candidate products; resolve all blockers before applying.");

  const touchedStoreIds = new Set<string>();
  const touchedCategoryIds = new Set<string>();
  let snapshotsPublished = 0;

  for (const plan of plans) {
    const product = await prisma.catalogProduct.findUniqueOrThrow({
      where: { id: plan.productId },
      include: {
        primaryCategory: true,
        productTypeDefinition: true,
        brand: true,
        media: {
          include: { asset: true },
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    await prisma.catalogProduct.update({
      where: { id: product.id },
      data: {
        status: "ACTIVE",
        moderationStatus: "APPROVED",
        publicationStatus: "PUBLISHED",
        approvedByUserId: product.approvedByUserId ?? run.createdByUserId,
      },
    });

    touchedCategoryIds.add(product.primaryCategoryId);

    for (const offerId of plan.offerIds) {
      const offer = await prisma.storeCatalogOffer.findUniqueOrThrow({
        where: { id: offerId },
        include: {
          store: true,
          variant: {
            include: {
              optionValues: {
                include: { optionValue: { include: { option: true } } },
              },
            },
          },
          currentPriceVersion: true,
          inventoryItem: { include: { levels: true } },
        },
      });
      const price = offer.currentPriceVersion;
      if (!price) throw new Error("Offer lost its current price before publication.");

      await prisma.storeCatalogOffer.update({
        where: { id: offer.id },
        data: {
          status: "ACTIVE",
          publicationStatus: "PUBLISHED",
        },
      });

      const media = product.media
        .filter(
          (entry) =>
            entry.asset.status === "READY" &&
            entry.asset.privacyInspectionPassed &&
            entry.asset.width &&
            entry.asset.height,
        )
        .map((entry) => ({
          assetReference: entry.asset.publicReference,
          role: entry.role,
          altText: entry.altText,
          order: entry.displayOrder,
        }));
      if (!media.some((entry) => entry.role === "PRIMARY")) {
        throw new Error("Publication candidate lost primary media evidence.");
      }

      const availability = deriveStorefrontAvailability({
        trackingMode: offer.inventoryTrackingMode,
        availableQuantities:
          offer.inventoryItem?.levels.map((level) => level.available) ?? [],
        allowBackorder: offer.inventoryItem?.allowBackorder,
        sourceFresh:
          offer.inventoryTrackingMode !== "TRACKED" ||
          Boolean(offer.inventoryItem?.levels.length),
        eligible: true,
      });

      const variantOptions = Object.fromEntries(
        offer.variant.optionValues.map((link) => [
          link.optionValue.option.code,
          link.optionValue.label,
        ]),
      );

      const snapshotValue = buildCatalogPublicationSnapshot({
        productReference: product.publicReference,
        variantReference: offer.variant.publicReference,
        offerReference: offer.publicReference,
        storeReference: offer.store.slug,
        productTypeCode: product.productTypeDefinition.code,
        productTypeVersion: product.productTypeVersionNumber,
        categoryPath: product.primaryCategory.path,
        title: product.title,
        description: product.description ?? product.shortDescription ?? "",
        ...(product.brand ? { brand: product.brand.name } : {}),
        identifiers: {
          sku: offer.storeSku,
          ...(offer.variant.gtin ? { barcode: offer.variant.gtin } : {}),
        },
        attributes:
          product.attributeValues &&
          typeof product.attributeValues === "object" &&
          !Array.isArray(product.attributeValues)
            ? (product.attributeValues as Record<string, unknown>)
            : {},
        variantOptions,
        price: {
          versionReference: price.publicReference,
          amount: price.amount.toFixed(2),
          currency: "ZAR",
          includesTax: true,
        },
        availability: { state: availability },
        media,
        compliance:
          product.complianceValues &&
          typeof product.complianceValues === "object" &&
          !Array.isArray(product.complianceValues)
            ? (product.complianceValues as Record<string, unknown>)
            : {},
      });

      let snapshot = await prisma.catalogPublicationSnapshot.findUnique({
        where: {
          offerId_publicationVersion: {
            offerId: offer.id,
            publicationVersion: snapshotValue.publicationVersion,
          },
        },
      });

      if (!snapshot) {
        const latest = await prisma.catalogPublicationSnapshot.findFirst({
          where: { offerId: offer.id },
          orderBy: { versionNumber: "desc" },
        });
        const nextVersion = (latest?.versionNumber ?? 0) + 1;
        snapshot = await prisma.catalogPublicationSnapshot.create({
          data: {
            publicReference:
              "LEG6-SNAP-" +
              plan.sourceId +
              "-" +
              nextVersion +
              "-" +
              offer.id.slice(-8),
            productId: product.id,
            variantId: offer.variantId,
            offerId: offer.id,
            versionNumber: nextVersion,
            publicationVersion: snapshotValue.publicationVersion,
            snapshot: JSON.parse(JSON.stringify(snapshotValue)) as Prisma.InputJsonValue,
            status: "PUBLISHED",
            createdByUserId: run.createdByUserId ?? offer.createdByUserId,
            createdAt: new Date(),
          },
        });
      } else if (snapshot.status !== "PUBLISHED") {
        snapshot = await prisma.catalogPublicationSnapshot.update({
          where: { id: snapshot.id },
          data: { status: "PUBLISHED", supersededAt: null },
        });
      }

      await projectionService.buildPublishedSnapshot(snapshot.publicReference);
      snapshotsPublished += 1;
      touchedStoreIds.add(offer.storeId);
    }
  }

  for (const storeId of touchedStoreIds) {
    await rebuildStorefrontStoreDocument(storeId);
  }
  for (const categoryId of touchedCategoryIds) {
    await rebuildStorefrontCategoryDocument(categoryId);
  }

  await prisma.legacyMigrationRun.update({
    where: { id: run.id },
    data: {
      status: "APPLIED",
      completedAt: new Date(),
      summary: {
        ...(run.summary && typeof run.summary === "object" ? run.summary : {}),
        publishedProducts: plans.length,
        publishedOffers: snapshotsPublished,
        blockedProducts: blocked,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ...dryRun,
        snapshotsPublished,
        storesRebuilt: touchedStoreIds.size,
        categoriesRebuilt: touchedCategoryIds.size,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Legacy catalogue publication failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
