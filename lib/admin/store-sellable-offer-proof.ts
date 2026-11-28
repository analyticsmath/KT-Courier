import { CatalogFulfilmentMode, CatalogSellingUnit, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { priceForOrderQuantity, type VolumePriceTier } from "@/lib/catalog/volume-pricing";
import {
  classifyTrustedMarketplaceParcel,
  type ParcelLimits,
  type TrustedPackageVersion,
  type TrustedParcelClassification,
} from "@/lib/marketplace-checkout/parcel-classification";
import { listTrustedPackageVersionsSafely } from "@/lib/marketplace-checkout/parcel-configuration.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";

type CatalogReadDb = Prisma.TransactionClient | typeof prisma;

export interface EligibleProofOffer {
  readonly offerId: string;
  readonly offerReference: string;
  readonly offerVersion: number;
  readonly productId: string;
  readonly productReference: string;
  readonly productTitle: string;
  readonly variantId: string;
  readonly variantReference: string;
  readonly fulfilmentMode: CatalogFulfilmentMode;
  readonly sellingUnit: CatalogSellingUnit;
  readonly quantity: number;
  readonly priceVersionId: string;
  readonly priceVersionReference: string;
  readonly unitPriceZar: string;
  readonly priceIncludesTax: boolean;
  readonly trackingMode: string;
  readonly allowBackorder: boolean;
  readonly availableLevelId: string | null;
  readonly availableStock: number | null;
  readonly modifiers: ReadonlyArray<{
    readonly groupReference: string;
    readonly optionReference: string;
    readonly quantity: number;
    readonly priceDeltaZar: string;
  }>;
  readonly modifierUnitTotalZar: string;
  readonly parcelClassification: TrustedParcelClassification | null;
}

export async function loadActiveParcelProfilesForProof(
  db: CatalogReadDb,
  now = new Date(),
): Promise<ParcelLimits[]> {
  if (typeof (db as { parcelProfileVersion?: { findMany?: unknown } }).parcelProfileVersion?.findMany !== "function") {
    return [];
  }
  const rows = await db.parcelProfileVersion.findMany({
    where: {
      stableKey: { in: ["SMALL", "MEDIUM", "LARGE"] },
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ stableKey: "asc" }, { versionNumber: "desc" }],
    select: {
      id: true,
      stableKey: true,
      versionNumber: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
      maximumWeightKg: true,
    },
  });
  const byKey = new Map<string, ParcelLimits>();
  for (const row of rows) {
    if (!byKey.has(row.stableKey)) {
      byKey.set(row.stableKey, {
        id: row.id,
        stableKey: row.stableKey,
        versionNumber: row.versionNumber,
        lengthCm: Number(row.lengthCm),
        widthCm: Number(row.widthCm),
        heightCm: Number(row.heightCm),
        maximumWeightKg: Number(row.maximumWeightKg),
      });
    }
  }
  return [...byKey.values()];
}

export async function selectEligibleSellableOffersForStore(
  db: CatalogReadDb,
  storeId: string,
  now = new Date(),
  options?: Readonly<{
    trustedPackageVersions?: TrustedPackageVersion[];
    activeParcelProfiles?: ParcelLimits[];
  }>,
): Promise<EligibleProofOffer[]> {
  const client = db as unknown as {
    storeCatalogOffer?: CatalogReadDb["storeCatalogOffer"];
    storeOfferPriceVersion?: CatalogReadDb["storeOfferPriceVersion"];
    catalogInventoryItem?: CatalogReadDb["catalogInventoryItem"];
  };
  if (
    typeof client.storeCatalogOffer?.findMany !== "function" ||
    typeof client.storeOfferPriceVersion?.findMany !== "function" ||
    typeof client.catalogInventoryItem?.findMany !== "function"
  ) {
    return [];
  }

  const offers = await client.storeCatalogOffer.findMany({
    where: {
      storeId,
      status: "ACTIVE",
      publicationStatus: "PUBLISHED",
      product: {
        status: "ACTIVE",
        primaryCategory: { status: "ACTIVE" },
        productTypeDefinition: { status: "ACTIVE" },
      },
      variant: { status: "ACTIVE" },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 25,
    include: {
      product: {
        select: {
          id: true,
          publicReference: true,
          title: true,
          media: {
            include: { asset: { select: { status: true } } },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          },
        },
      },
      variant: {
        select: { id: true, publicReference: true, status: true },
      },
      modifierGroups: {
        include: {
          group: {
            include: {
              options: {
                where: { status: "ACTIVE" },
                orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
              },
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { groupId: "asc" }],
      },
    },
  });

  if (offers.length === 0) return [];

  const offerIds = offers.map((offer) => offer.id);
  const [prices, inventories] = await Promise.all([
    client.storeOfferPriceVersion.findMany({
      where: {
        offerId: { in: offerIds },
        status: "ACTIVE",
        currency: "ZAR",
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: [{ versionNumber: "desc" }, { id: "desc" }],
    }),
    client.catalogInventoryItem.findMany({
      where: { offerId: { in: offerIds } },
      include: {
        levels: {
          include: {
            location: { select: { id: true, status: true } },
          },
          orderBy: [{ available: "desc" }, { id: "asc" }],
        },
      },
    }),
  ]);

  const pricesByOfferId = new Map<string, typeof prices>();
  for (const price of prices) {
    const bucket = pricesByOfferId.get(price.offerId) ?? [];
    bucket.push(price);
    pricesByOfferId.set(price.offerId, bucket);
  }
  const inventoryByOfferId = new Map(inventories.map((item) => [item.offerId, item]));

  const needsCourierPackaging = offers.some((offer) => offer.fulfilmentMode !== "STORE_PICKUP");
  const storeIsQaAcceptance =
    typeof (db as { store?: { findUnique?: unknown } })?.store?.findUnique === "function"
      ? Boolean(
          (
            await (db as unknown as {
              store: { findUnique: (args: { where: { id: string }; select: { isQaAcceptance: true } }) => Promise<{ isQaAcceptance?: boolean } | null> };
            }).store.findUnique({ where: { id: storeId }, select: { isQaAcceptance: true } })
          )?.isQaAcceptance,
        )
      : false;
  const [trustedVersionsRaw, activeParcelProfiles] = needsCourierPackaging
    ? await Promise.all([
        options?.trustedPackageVersions
          ? Promise.resolve(options.trustedPackageVersions)
          : listTrustedPackageVersionsSafely().then((res) => res.versions),
        options?.activeParcelProfiles
          ? Promise.resolve(options.activeParcelProfiles)
          : loadActiveParcelProfilesForProof(db, now),
      ])
    : [[], []];
  const trustedVersions = trustedVersionsRaw.map((version) => ({ ...version, packages: [...version.packages] }));
  if (needsCourierPackaging && typeof (db as { systemSetting?: { findUnique?: unknown } })?.systemSetting?.findUnique === "function") {
    for (const version of trustedVersions) {
      for (const entry of version.packages) {
        if (entry.storeId !== storeId || !entry.authorityReference.startsWith(PACKAGING_PREFIX)) continue;
        const declRow = await (db as unknown as {
          systemSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ value: unknown } | null> };
        }).systemSetting.findUnique({ where: { key: PACKAGING_PREFIX + entry.offerReference } });
        const revision = (declRow?.value as { revision?: string } | null)?.revision;
        if (!revision || entry.authorityReference !== `${PACKAGING_PREFIX}${entry.offerReference}:${revision}`) {
          entry.authorityReference = "STALE_VENDOR_MEASUREMENTS";
        }
      }
    }
  }
  const filteredTrustedVersions = trustedVersions.map((version) => ({
    ...version,
    packages: version.packages.filter((entry) => entry.authorityReference !== "STALE_VENDOR_MEASUREMENTS"),
  }));

  const eligible: EligibleProofOffer[] = [];
  for (const offer of offers) {
    if (offer.sellingUnit === "VARIABLE_WEIGHT" && !offer.packagedQuantity) {
      continue;
    }

    const quantity = Math.max(1, Math.ceil(Number(offer.minimumQuantity ?? 1)));

    const offerPrices = pricesByOfferId.get(offer.id) ?? [];
    const activePrice =
      (offer.currentPriceVersionId
        ? offerPrices.find((p) => p.id === offer.currentPriceVersionId)
        : undefined) ?? offerPrices[0];
    if (!activePrice || activePrice.currency !== "ZAR" || Number(activePrice.amount) <= 0) {
      continue;
    }

    let unitPriceZar: string;
    try {
      unitPriceZar = priceForOrderQuantity(
        activePrice.amount.toFixed(2),
        (activePrice.volumeTiers ?? []) as VolumePriceTier[],
        quantity,
      );
    } catch {
      continue;
    }
    if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(unitPriceZar) || Number(unitPriceZar) <= 0) {
      continue;
    }

    const hasReadyMedia = offer.product.media.some(
      (link) =>
        (link.variantId === null || link.variantId === offer.variantId) &&
        link.asset.status === "READY",
    );
    if (!hasReadyMedia) {
      continue;
    }

    const selectedModifiers: Array<{
      readonly groupReference: string;
      readonly optionReference: string;
      readonly quantity: number;
      readonly priceDeltaZar: string;
    }> = [];
    let modifiersSatisfied = true;
    let modifierUnitTotalDecimal = new Prisma.Decimal(0);
    for (const link of offer.modifierGroups) {
      const group = link.group;
      const requiredCount = group.isRequired
        ? Math.max(1, group.minimumSelections)
        : group.minimumSelections;
      if (requiredCount > 0) {
        if (group.status !== "ACTIVE" || group.options.length === 0) {
          modifiersSatisfied = false;
          break;
        }
        const option = group.options[0];
        if (!option || requiredCount > group.maximumSelections) {
          modifiersSatisfied = false;
          break;
        }
        selectedModifiers.push({
          groupReference: group.publicReference,
          optionReference: option.publicReference,
          quantity: requiredCount,
          priceDeltaZar: option.priceDelta.toFixed(2),
        });
        modifierUnitTotalDecimal = modifierUnitTotalDecimal.add(
          new Prisma.Decimal(option.priceDelta).mul(requiredCount),
        );
      }
    }
    if (!modifiersSatisfied) {
      continue;
    }

    const inventoryItem = inventoryByOfferId.get(offer.id);
    if (!inventoryItem) {
      continue;
    }
    const activeLevels = inventoryItem.levels.filter((level) => level.location.status === "ACTIVE");
    const stockFlexible =
      inventoryItem.trackingMode === "UNTRACKED" ||
      inventoryItem.trackingMode === "MADE_TO_ORDER" ||
      inventoryItem.allowBackorder;
    const fulfillingLevel = activeLevels.find((level) => level.available >= quantity) ?? null;
    if (!stockFlexible && !fulfillingLevel) {
      continue;
    }

    let parcelClassification: TrustedParcelClassification | null = null;
    if (offer.fulfilmentMode !== "STORE_PICKUP") {
      parcelClassification = classifyTrustedMarketplaceParcel({
        storeId,
        storeIsQaAcceptance,
        lines: [
          {
            offerReference: offer.publicReference,
            variantReference: offer.variant.publicReference,
            publicationVersion: String(offer.version),
            quantity,
            modifiers: selectedModifiers.map((m) => ({
              optionReference: m.optionReference,
              quantity: m.quantity,
            })),
          },
        ],
        versions: filteredTrustedVersions,
        profiles: activeParcelProfiles,
        now,
      });
      if (parcelClassification.status !== "CLASSIFIED" || !parcelClassification.sizeClass) {
        continue;
      }
    }

    eligible.push({
      offerId: offer.id,
      offerReference: offer.publicReference,
      offerVersion: offer.version,
      productId: offer.product.id,
      productReference: offer.product.publicReference,
      productTitle: offer.product.title,
      variantId: offer.variant.id,
      variantReference: offer.variant.publicReference,
      fulfilmentMode: offer.fulfilmentMode,
      sellingUnit: offer.sellingUnit ?? "EACH",
      quantity,
      priceVersionId: activePrice.id,
      priceVersionReference: activePrice.publicReference,
      unitPriceZar,
      priceIncludesTax: Boolean(activePrice.priceIncludesTax),
      trackingMode: inventoryItem.trackingMode,
      allowBackorder: inventoryItem.allowBackorder,
      availableLevelId: fulfillingLevel?.id ?? null,
      availableStock: fulfillingLevel?.available ?? null,
      modifiers: selectedModifiers,
      modifierUnitTotalZar: modifierUnitTotalDecimal.toFixed(2),
      parcelClassification,
    });
  }

  eligible.sort((left, right) => {
    const leftCourier = left.fulfilmentMode !== "STORE_PICKUP" ? 0 : 1;
    const rightCourier = right.fulfilmentMode !== "STORE_PICKUP" ? 0 : 1;
    if (leftCourier !== rightCourier) return leftCourier - rightCourier;
    return right.offerVersion - left.offerVersion;
  });

  return eligible;
}
