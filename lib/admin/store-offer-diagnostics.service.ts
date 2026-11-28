import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { classifyTrustedMarketplaceParcel, type ParcelSourceLine, type TrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-classification";
import { listTrustedPackageVersionsSafely } from "@/lib/marketplace-checkout/parcel-configuration.service";
import { loadActiveParcelProfilesForProof } from "@/lib/admin/store-sellable-offer-proof";
import { listCatalogPackaging } from "@/lib/services/catalog-packaging.service";

export type OfferPredicateCheck = Readonly<{
  code: string;
  label: string;
  passed: boolean;
  detail: string;
  repairHref?: string;
}>;

export type StoreOfferSellabilityDiagnostic = Readonly<{
  offerId: string;
  offerReference: string;
  offerVersion: number;
  storeSku: string;
  title: string;
  variantReference: string;
  variantTitle: string;
  offerStatus: string;
  publicationStatus: string;
  fulfilmentMode: string;
  inventoryTrackingMode: string;
  sellableForCheckout: boolean;
  failedReasonCodes: readonly string[];
  checks: readonly OfferPredicateCheck[];
  packaging: Readonly<{
    declarationPresent: boolean;
    declarationDimensionsCm: string | null;
    declarationWeightKg: string | null;
    declarationSubmittedAt: string | null;
    trustedPackageMatched: boolean;
    trustedPackageReason: string | null;
    trustedPackageVersion: number | null;
    trustedPackageStatus: string | null;
    trustedPackageAuthorityReference: string | null;
    isQaSyntheticAuthority: boolean;
    candidateTrustedVersions: readonly Readonly<{
      version: number;
      status: string;
      publicationVersion: string;
      authorityReference: string;
      effectiveFrom: string;
      effectiveTo: string | null;
      matchesOfferVersion: boolean;
    }>[];
  }>;
  repairLinks: readonly Readonly<{ label: string; href: string }>[];
}>;

export type StoreOfferDiagnosticsReport = Readonly<{
  storeId: string;
  storeName: string;
  isQaAcceptance: boolean;
  totalOffers: number;
  sellableCount: number;
  trustedPackageLoadIssuesCount: number;
  offers: readonly StoreOfferSellabilityDiagnostic[];
}>;

type DiagnosticDb = Pick<Prisma.TransactionClient, "store" | "storeCatalogOffer">;

export async function diagnoseStoreOffersSellability(
  storeId: string,
  options?: Readonly<{
    db?: DiagnosticDb;
    now?: Date;
    trustedPackageVersions?: TrustedPackageVersion[];
  }>,
): Promise<StoreOfferDiagnosticsReport | null> {
  const db = options?.db ?? prisma;
  const now = options?.now ?? new Date();
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, isQaAcceptance: true },
  });
  if (!store) return null;

  const [offers, profiles, declarations, loadedPackages] = await Promise.all([
    db.storeCatalogOffer.findMany({
      where: { storeId: store.id, status: { not: "ARCHIVED" } },
      orderBy: [{ updatedAt: "desc" }, { publicReference: "asc" }],
      take: 100,
      include: {
        product: {
          include: {
            primaryCategory: { select: { status: true } },
            productTypeDefinition: { select: { status: true } },
            media: {
              where: { role: { not: "COMPLIANCE_DOCUMENT" } },
              include: {
                asset: {
                  select: {
                    status: true,
                    privacyInspectionPassed: true,
                    storageConfirmedAt: true,
                    validatedAt: true,
                  },
                },
              },
            },
          },
        },
        variant: { select: { publicReference: true, title: true, status: true } },
        priceVersions: {
          orderBy: [{ versionNumber: "desc" }, { id: "desc" }],
          take: 10,
        },
        inventoryItem: {
          include: {
            levels: {
              include: { location: { select: { status: true } } },
            },
          },
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
        },
      },
    }),
    loadActiveParcelProfilesForProof(db as Prisma.TransactionClient, now),
    listCatalogPackaging(store.id),
    options?.trustedPackageVersions
      ? Promise.resolve({ versions: options.trustedPackageVersions, malformedKeys: [] as string[] })
      : listTrustedPackageVersionsSafely(),
  ]);

  const versions = loadedPackages.versions;
  const declByOfferRef = new Map(declarations.map((d) => [d.offerReference, d]));

  const diagnostics: StoreOfferSellabilityDiagnostic[] = [];

  for (const offer of offers) {
    const checks: OfferPredicateCheck[] = [];
    const failedReasonCodes: string[] = [];
    const repairMap = new Map<string, { label: string; href: string }>();
    const addRepair = (label: string, href: string) => {
      if (!repairMap.has(href)) repairMap.set(href, { label, href });
    };
    const recordCheck = (check: OfferPredicateCheck) => {
      checks.push(check);
      if (!check.passed) {
        failedReasonCodes.push(check.code);
        if (check.repairHref) {
          addRepair(check.label, check.repairHref);
        }
      }
    };

    const offerAdminHref = `/admin/catalog/offers/${encodeURIComponent(offer.publicReference)}`;
    const productStoreHref = `/store/catalog/products/${encodeURIComponent(offer.product.publicReference)}`;
    const policyAdminHref = "/admin/marketplace-delivery-policy";

    const offerPublished = offer.status === "ACTIVE" && offer.publicationStatus === "PUBLISHED";
    recordCheck({
      code: "OFFER_NOT_ACTIVE_OR_UNPUBLISHED",
      label: "Offer active & published",
      passed: offerPublished,
      detail: offerPublished
        ? `Offer ${offer.publicReference} (rev ${offer.version}) is ACTIVE and PUBLISHED.`
        : `Offer status=${offer.status}, publicationStatus=${offer.publicationStatus} (requires ACTIVE + PUBLISHED).`,
      repairHref: offerAdminHref,
    });

    const productActive =
      offer.product.status === "ACTIVE" && offer.product.moderationStatus === "APPROVED";
    recordCheck({
      code: "PRODUCT_NOT_ACTIVE_OR_APPROVED",
      label: "Product active & approved",
      passed: productActive,
      detail: productActive
        ? `Product ${offer.product.publicReference} is ACTIVE & APPROVED.`
        : `Product status=${offer.product.status}, moderationStatus=${offer.product.moderationStatus}.`,
      repairHref: `/admin/catalog/products/${encodeURIComponent(offer.product.publicReference)}`,
    });

    const categoryAndTypeActive =
      offer.product.primaryCategory.status === "ACTIVE" &&
      offer.product.productTypeDefinition.status === "ACTIVE";
    recordCheck({
      code: "CATEGORY_OR_TYPE_INACTIVE",
      label: "Category & product type active",
      passed: categoryAndTypeActive,
      detail: categoryAndTypeActive
        ? "Category and product type are ACTIVE."
        : `Category=${offer.product.primaryCategory.status}, type=${offer.product.productTypeDefinition.status}.`,
    });

    const variantActive = offer.variant.status === "ACTIVE";
    recordCheck({
      code: "VARIANT_NOT_ACTIVE",
      label: "Variant active",
      passed: variantActive,
      detail: variantActive
        ? `Variant ${offer.variant.publicReference} is ACTIVE.`
        : `Variant ${offer.variant.publicReference} status is ${offer.variant.status} (must be ACTIVE).`,
      repairHref: offerAdminHref,
    });

    const currentActivePrice =
      offer.priceVersions.find(
        (pv) =>
          (offer.currentPriceVersionId ? pv.id === offer.currentPriceVersionId : true) &&
          pv.status === "ACTIVE" &&
          pv.currency === "ZAR" &&
          pv.amount.gt(0) &&
          pv.effectiveFrom <= now &&
          (pv.effectiveUntil === null || pv.effectiveUntil > now),
      ) ?? null;
    recordCheck({
      code: "ACTIVE_ZAR_PRICE_MISSING",
      label: "Current active ZAR price",
      passed: Boolean(currentActivePrice),
      detail: currentActivePrice
        ? `Active price ${currentActivePrice.publicReference}: R ${currentActivePrice.amount.toFixed(2)}.`
        : "No current effective ACTIVE ZAR > 0 price found on this offer.",
      repairHref: offerAdminHref,
    });

    const mediaItems = offer.product.media;
    const primaryReady = mediaItems.some(
      (m) =>
        m.role === "PRIMARY" &&
        m.variantId === null &&
        m.asset.status === "READY" &&
        m.asset.privacyInspectionPassed &&
        Boolean(m.asset.storageConfirmedAt) &&
        Boolean(m.asset.validatedAt),
    );
    const allMediaReady =
      mediaItems.length > 0 &&
      mediaItems.every(
        (m) =>
          m.asset.status === "READY" &&
          m.asset.privacyInspectionPassed &&
          Boolean(m.asset.storageConfirmedAt) &&
          Boolean(m.asset.validatedAt),
      );
    recordCheck({
      code: "PRIMARY_MEDIA_NOT_READY",
      label: "Primary & product media READY",
      passed: primaryReady && allMediaReady,
      detail:
        primaryReady && allMediaReady
          ? `${mediaItems.length} validated READY media asset(s) present.`
          : `Primary ready=${primaryReady}, all ready=${allMediaReady} (${mediaItems.length} item(s)).`,
      repairHref: productStoreHref,
    });

    const modifierViolation = offer.modifierGroups.some((link) => {
      if (link.group.status !== "ACTIVE") return false;
      const min = Math.max(link.group.isRequired ? 1 : 0, link.group.minimumSelections);
      return min > 0 && link.group.options.length < min;
    });
    recordCheck({
      code: "MODIFIER_OPTIONS_MISSING",
      label: "Required modifier options",
      passed: !modifierViolation,
      detail: modifierViolation
        ? "A required active modifier group has fewer active options than minimumSelections."
        : "All modifier constraints satisfied.",
    });

    const selectedModifierSelections = offer.modifierGroups
      .filter((link) => link.group.status === "ACTIVE")
      .flatMap((link) => {
        const min = Math.max(link.group.isRequired ? 1 : 0, link.group.minimumSelections);
        return min > 0 && link.group.options[0]
          ? [{ optionReference: link.group.options[0].publicReference, quantity: min }]
          : [];
      });

    const quantity = Math.max(1, Math.ceil(Number(offer.minimumQuantity)));
    const allowBackorder = offer.inventoryItem?.allowBackorder === true;
    const activeLevels = (offer.inventoryItem?.levels ?? []).filter(
      (level) => level.location.status === "ACTIVE",
    );
    const activeAvailable = activeLevels.reduce((sum, lvl) => sum + lvl.available, 0);
    const stockOk =
      offer.inventoryTrackingMode === "UNTRACKED" ||
      offer.inventoryTrackingMode === "MADE_TO_ORDER" ||
      allowBackorder ||
      activeAvailable >= quantity;
    recordCheck({
      code: "INVENTORY_UNAVAILABLE",
      label: "Active inventory available",
      passed: stockOk,
      detail: stockOk
        ? offer.inventoryTrackingMode === "TRACKED"
          ? `${activeAvailable} unit(s) available across active location(s) (minimum required: ${quantity}).`
          : `Tracking mode ${offer.inventoryTrackingMode} allows fulfilment.`
        : `Tracked inventory has ${activeAvailable} available across ACTIVE locations, needs >= ${quantity}.`,
      repairHref: "/store/catalog/inventory",
    });

    const decl = declByOfferRef.get(offer.publicReference) ?? null;
    const candidateTrustedVersions = versions
      .flatMap((v) =>
        v.packages
          .filter((p) => p.storeId === store.id && p.offerReference === offer.publicReference)
          .map((p) => ({
            version: v.version,
            status: v.status,
            publicationVersion: p.publicationVersion,
            authorityReference: p.authorityReference,
            effectiveFrom: v.effectiveFrom,
            effectiveTo: v.effectiveTo,
            matchesOfferVersion: p.publicationVersion === String(offer.version),
          })),
      )
      .sort((a, b) => b.version - a.version);

    let trustedPackageMatched = offer.fulfilmentMode === "STORE_PICKUP";
    let trustedPackageReason: string | null =
      offer.fulfilmentMode === "STORE_PICKUP" ? "STORE_PICKUP" : null;
    let trustedPackageVersion: number | null = null;
    let trustedPackageStatus: string | null = null;
    let trustedPackageAuthorityReference: string | null = null;
    let isQaSyntheticAuthority = false;

    if (offer.fulfilmentMode !== "STORE_PICKUP") {
      const parcelLine: ParcelSourceLine = {
        offerReference: offer.publicReference,
        variantReference: offer.variant.publicReference,
        publicationVersion: String(offer.version),
        quantity,
        modifiers: selectedModifierSelections,
      };
      const classification = classifyTrustedMarketplaceParcel({
        storeId: store.id,
        storeIsQaAcceptance: store.isQaAcceptance,
        lines: [parcelLine],
        versions,
        profiles,
        now,
      });
      trustedPackageMatched =
        classification.status === "CLASSIFIED" && Boolean(classification.sizeClass);
      trustedPackageReason = classification.reason;
      trustedPackageVersion = classification.packageVersion;
      if (trustedPackageVersion !== null) {
        const matchedVer = versions.find((v) => v.version === trustedPackageVersion);
        const matchedPkg = matchedVer?.packages.find(
          (p) =>
            p.storeId === store.id &&
            p.offerReference === offer.publicReference &&
            p.variantReference === offer.variant.publicReference,
        );
        trustedPackageStatus = matchedVer?.status ?? null;
        trustedPackageAuthorityReference = matchedPkg?.authorityReference ?? null;
        isQaSyntheticAuthority = Boolean(
          matchedPkg?.qaScope?.qaAcceptanceOnly ||
            matchedPkg?.authorityReference.startsWith("qa-synthetic-pkg:"),
        );
      }

      const staleVersionExists =
        !trustedPackageMatched &&
        candidateTrustedVersions.some(
          (c) => c.status === "ACTIVE" && !c.matchesOfferVersion,
        );
      const pendingDraftExists =
        !trustedPackageMatched &&
        candidateTrustedVersions.some((c) => c.status !== "ACTIVE" && c.matchesOfferVersion);

      const packagingCode = trustedPackageMatched
        ? "TRUSTED_PACKAGING_MATCHED"
        : staleVersionExists
          ? "TRUSTED_PACKAGE_PUBLICATION_VERSION_MISMATCH"
          : pendingDraftExists
            ? "TRUSTED_PACKAGE_PENDING_APPROVAL_OR_ACTIVATION"
            : classification.status === "UNSUPPORTED"
              ? "PARCEL_PROFILE_LIMIT_EXCEEDED"
              : "TRUSTED_PACKAGE_MISSING";

      recordCheck({
        code: packagingCode,
        label: "Approved trusted delivery packaging",
        passed: trustedPackageMatched,
        detail: trustedPackageMatched
          ? `Classified via trusted packaging v${trustedPackageVersion} (${classification.reason}).`
          : staleVersionExists
            ? `Approved trusted packaging exists but binds to offer revision ${candidateTrustedVersions.find((c) => c.status === "ACTIVE")?.publicationVersion} while offer is now version ${offer.version}. (${classification.reason})`
            : pendingDraftExists
              ? `Trusted packaging draft exists for offer v${offer.version} but is ${candidateTrustedVersions.find((c) => c.matchesOfferVersion)?.status}, not ACTIVE.`
              : decl
                ? `Vendor declaration exists (${decl.lengthCm}x${decl.widthCm}x${decl.heightCm} cm, ${decl.weightKg} kg), awaiting admin TrustedPackageVersion promotion/approval (${classification.reason}).`
                : `No vendor packaging declaration or approved TrustedPackageVersion found (${classification.reason}).`,
        repairHref: decl ? policyAdminHref : productStoreHref,
      });
    } else {
      recordCheck({
        code: "STORE_PICKUP_NO_PARCEL",
        label: "Store pickup fulfilment",
        passed: true,
        detail: "STORE_PICKUP offer does not require courier parcel packaging.",
      });
    }

    diagnostics.push(
      Object.freeze({
        offerId: offer.id,
        offerReference: offer.publicReference,
        offerVersion: offer.version,
        storeSku: offer.storeSku,
        title: offer.merchantTitle?.trim() || offer.product.title,
        variantReference: offer.variant.publicReference,
        variantTitle: offer.variant.title,
        offerStatus: offer.status,
        publicationStatus: offer.publicationStatus,
        fulfilmentMode: offer.fulfilmentMode,
        inventoryTrackingMode: offer.inventoryTrackingMode,
        sellableForCheckout: failedReasonCodes.length === 0,
        failedReasonCodes: Object.freeze(failedReasonCodes),
        checks: Object.freeze(checks),
        packaging: Object.freeze({
          declarationPresent: Boolean(decl),
          declarationDimensionsCm: decl
            ? `${decl.lengthCm} × ${decl.widthCm} × ${decl.heightCm}`
            : null,
          declarationWeightKg: decl ? String(decl.weightKg) : null,
          declarationSubmittedAt: decl?.submittedAt ?? null,
          trustedPackageMatched,
          trustedPackageReason,
          trustedPackageVersion,
          trustedPackageStatus,
          trustedPackageAuthorityReference,
          isQaSyntheticAuthority,
          candidateTrustedVersions: Object.freeze(candidateTrustedVersions),
        }),
        repairLinks: Object.freeze([...repairMap.values()]),
      }),
    );
  }

  return Object.freeze({
    storeId: store.id,
    storeName: store.name,
    isQaAcceptance: store.isQaAcceptance,
    totalOffers: diagnostics.length,
    sellableCount: diagnostics.filter((d) => d.sellableForCheckout).length,
    trustedPackageLoadIssuesCount: loadedPackages.malformedKeys.length,
    offers: Object.freeze(diagnostics),
  });
}
