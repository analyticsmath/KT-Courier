import { prisma } from "@/lib/db/prisma";
import { getGlobalCommercePolicyRevision } from "@/lib/admin/commerce-readiness-revision";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";
import { describeStoreCollectionEvidence } from "@/lib/admin/store-pickup-readiness";
import { selectEligibleSellableOffersForStore } from "@/lib/admin/store-sellable-offer-proof";
import {
  selectStorePickupCandidate,
  type StorePickupAddressCandidate,
} from "@/lib/marketplace-checkout/store-pickup-selection";
import { getStoreSellerIdentityState } from "@/lib/services/store-seller-identity.service";
import {
  isStoreOperationalPolicyEffective,
  isStorePubliclyCheckoutReady,
  isStoreSellerIdentityEffective,
  type PublicStoreCheckoutCertificate,
} from "@/lib/storefront/store-publication-readiness";
import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type StoreOnboardingShopState =
  | "ACCOUNT_APPLICATION"
  | "ACCOUNT_APPROVED"
  | "GETTING_SHOP_READY"
  | "SHOP_LIVE"
  | "SHOP_PAUSED";

export type StoreOnboardingStageStatus =
  | "COMPLETE"
  | "IN_PROGRESS"
  | "ACTION_REQUIRED"
  | "WAITING_ADMIN";

export interface StoreOnboardingNextAction {
  label: string;
  description: string;
  href: string;
  actor: "OWNER" | "ADMIN" | "NONE";
}

export interface StoreOnboardingStage {
  id: "account_identity" | "pickup_inventory" | "first_product" | "commercial_certification";
  order: 1 | 2 | 3 | 4;
  title: string;
  status: StoreOnboardingStageStatus;
  summary: string;
  items: Array<{
    label: string;
    done: boolean;
    detail: string;
  }>;
  actionLabel: string;
  actionHref: string;
}

export interface StoreOnboardingProjection {
  storePublicReference: string;
  storeName: string;
  storeSlug: string;
  storeStatus: string;
  shopState: StoreOnboardingShopState;
  shopStateLabel: string;
  shopStateTone: ProtectedStatusTone;
  shopStateSummary: string;
  readyForCheckout: boolean;
  blockers: string[];
  ownerActionBlockers: string[];
  adminReviewBlockers: string[];
  nextAction: StoreOnboardingNextAction;
  metrics: {
    activeInventoryLocations: number;
    draftOrActiveProducts: number;
    approvedProducts: number;
    publishedOffers: number;
    sellableOffers: number;
    liveStorefrontProducts: number;
  };
  stages: StoreOnboardingStage[];
}

export interface StoreOnboardingFacts {
  storePublicReference: string;
  storeName: string;
  storeSlug: string;
  storeStatus: string;
  storeCommerceReadinessRevision: number;
  currentGlobalPolicyRevision: number;
  hasApprovedSellerIdentity: boolean;
  sellerIdentityStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | "NOT_STARTED";
  pickup: StorePickupAddressCandidate | null;
  activeInventoryLocations: number;
  draftOrActiveProducts: number;
  approvedProducts: number;
  publishedOffers: number;
  pausedOrOutOfStockOffers: number;
  sellableOffers: number;
  liveStorefrontProducts: number;
  hasActiveOperationalPolicy: boolean;
  hasActiveCommissionPlan: boolean;
  certification: PublicStoreCheckoutCertificate | null;
  storefrontPublicStatus: string | null;
  now?: Date;
}

const SHOP_STATE_META: Record<
  StoreOnboardingShopState,
  { label: string; tone: ProtectedStatusTone }
> = {
  ACCOUNT_APPLICATION: { label: "Account application", tone: "information" },
  ACCOUNT_APPROVED: { label: "Account approved", tone: "neutral" },
  GETTING_SHOP_READY: { label: "Getting shop ready", tone: "warning" },
  SHOP_LIVE: { label: "Shop LIVE", tone: "success" },
  SHOP_PAUSED: { label: "Shop paused", tone: "danger" },
};

function isAdminOnlyBlocker(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("account needs activation") ||
    lower.includes("operational policy missing") ||
    lower.includes("commission plan missing") ||
    lower.includes("certification") ||
    lower.includes("checkout-engine proof") ||
    lower.includes("paid-checkout review") ||
    lower.includes("reconfirm the saved pickup") ||
    lower.includes("platform delivery, tax, or operational policy changed") ||
    lower.includes("store catalog, pricing, pickup, or commercial readiness changed")
  );
}

export function deriveStoreOnboardingProjection(
  facts: StoreOnboardingFacts,
): StoreOnboardingProjection {
  const now = facts.now ?? new Date();
  const collection = describeStoreCollectionEvidence(facts.pickup);
  const pickupConfigured = collection.checkoutPickupConfigured;
  const pickupMissing = [...collection.missing];
  const blockers = describeStoreCheckoutBlockers({
    status: facts.storeStatus,
    name: facts.storeName,
    publishedOfferCount: facts.sellableOffers,
    pickup: facts.pickup,
    certification: facts.certification,
    hasApprovedSellerIdentity: facts.hasApprovedSellerIdentity,
    hasActiveOperationalPolicy: facts.hasActiveOperationalPolicy,
    hasActiveCommissionPlan: facts.hasActiveCommissionPlan,
    storeCommerceReadinessRevision: facts.storeCommerceReadinessRevision,
    currentGlobalPolicyRevision: facts.currentGlobalPolicyRevision,
    now,
  });
  const uniqueBlockers = [...new Set(blockers)];

  const readyForCheckout =
    facts.storeStatus === "ACTIVE" &&
    isStorePubliclyCheckoutReady({
      status: facts.storeStatus,
      name: facts.storeName,
      documentsCount: Math.min(facts.liveStorefrontProducts, facts.sellableOffers),
      pickup: facts.pickup,
      certification: facts.certification,
      hasApprovedSellerIdentity: facts.hasApprovedSellerIdentity,
      hasActiveOperationalPolicy: facts.hasActiveOperationalPolicy,
      hasActiveCommissionPlan: facts.hasActiveCommissionPlan,
      storeCommerceReadinessRevision: facts.storeCommerceReadinessRevision,
      currentGlobalPolicyRevision: facts.currentGlobalPolicyRevision,
      now,
    }) &&
    facts.liveStorefrontProducts > 0;

  const ownerSetupStarted =
    facts.sellerIdentityStatus !== "NOT_STARTED" ||
    pickupConfigured ||
    facts.activeInventoryLocations > 0 ||
    facts.draftOrActiveProducts > 0 ||
    facts.certification !== null;

  let shopState: StoreOnboardingShopState;
  let shopStateSummary: string;

  if (facts.storeStatus === "SUSPENDED" || facts.storeStatus === "DISABLED") {
    shopState = "SHOP_PAUSED";
    shopStateSummary =
      "This store account is currently restricted. Review account status or contact KT Couriers support before resuming public sales.";
  } else if (facts.storeStatus !== "ACTIVE") {
    shopState = "ACCOUNT_APPLICATION";
    shopStateSummary =
      "Your business application is awaiting KT Couriers approval. While it is reviewed, you can submit your legal seller identity, save your collection address, create stock locations, and prepare product drafts.";
  } else if (readyForCheckout) {
    shopState = "SHOP_LIVE";
    shopStateSummary = `Your shop is live on the public marketplace with ${facts.liveStorefrontProducts} purchasable ${facts.liveStorefrontProducts === 1 ? "listing" : "listings"} and active checkout certification.`;
  } else if (
    facts.certification?.status === "REVOKED" ||
    facts.certification?.status === "REJECTED" ||
    (facts.certification?.status === "APPROVED" && !readyForCheckout) ||
    (facts.pausedOrOutOfStockOffers > 0 && facts.sellableOffers === 0)
  ) {
    shopState = "SHOP_PAUSED";
    shopStateSummary =
      "Public marketplace selling is currently paused because offer stock, pricing, collection settings, platform policies, or checkout certification requires fresh verification.";
  } else if (!ownerSetupStarted) {
    shopState = "ACCOUNT_APPROVED";
    shopStateSummary =
      "Your business account is approved for courier dispatch. Complete the setup stages below to open your public marketplace shop.";
  } else {
    shopState = "GETTING_SHOP_READY";
    shopStateSummary =
      "Your shop setup is underway. Complete the remaining owner items below and obtain independent KT Couriers approvals to go live.";
  }

  const ownerActionBlockers: string[] = [];
  if (!facts.hasApprovedSellerIdentity) {
    if (facts.sellerIdentityStatus === "PENDING_REVIEW") {
      // Awaits admin review once submitted
    } else if (facts.sellerIdentityStatus === "REJECTED") {
      ownerActionBlockers.push("Resubmit corrected legal seller identity and verification document.");
    } else {
      ownerActionBlockers.push("Submit legal seller identity and supporting document (unregistered sole traders are supported).");
    }
  }
  if (!pickupConfigured) {
    ownerActionBlockers.push(
      pickupMissing.length > 0
        ? `Complete collection address & map pin: ${pickupMissing.join(", ")}.`
        : "Save a South African collection address with verified map coordinates.",
    );
  }
  if (facts.activeInventoryLocations < 1) {
    ownerActionBlockers.push("Create at least one active inventory stock location.");
  }
  if (facts.sellableOffers < 1) {
    if (facts.draftOrActiveProducts < 1) {
      ownerActionBlockers.push("Create your first product with photos, ZAR selling price, opening stock, and package dimensions.");
    } else if (facts.approvedProducts < 1) {
      ownerActionBlockers.push("Finish product details/photos and submit your product for catalog moderation review.");
    } else {
      ownerActionBlockers.push("Ensure at least one published offer has active ZAR pricing, positive available stock, and valid parcel packaging.");
    }
  }

  const adminReviewBlockers: string[] = [];
  if (facts.storeStatus === "PENDING") {
    adminReviewBlockers.push("Business account approval by KT Couriers administrator.");
  }
  if (!facts.hasApprovedSellerIdentity && facts.sellerIdentityStatus === "PENDING_REVIEW") {
    adminReviewBlockers.push("Independent review of your submitted legal seller identity.");
  }
  if (facts.draftOrActiveProducts > 0 && facts.approvedProducts < 1) {
    adminReviewBlockers.push("Catalog moderation & publication approval on submitted products/offers.");
  }
  if (!facts.hasActiveOperationalPolicy) {
    adminReviewBlockers.push("Active KT Couriers marketplace operational policy assignment.");
  }
  if (!facts.hasActiveCommissionPlan) {
    adminReviewBlockers.push("Approved store commission plan for marketplace settlements.");
  }
  if (!readyForCheckout && ownerActionBlockers.length === 0) {
    if (
      !facts.certification ||
      facts.certification.status !== "APPROVED" ||
      uniqueBlockers.some((b) => isAdminOnlyBlocker(b))
    ) {
      adminReviewBlockers.push(
        "Real sellable-offer route and checkout capability certification by KT Couriers administrators.",
      );
    }
  }

  // Build 4 stages
  const stage1Done = facts.storeStatus === "ACTIVE" && facts.hasApprovedSellerIdentity;
  const stage1Status: StoreOnboardingStageStatus = stage1Done
    ? "COMPLETE"
    : facts.sellerIdentityStatus === "REJECTED" ||
        facts.sellerIdentityStatus === "NOT_STARTED"
      ? "ACTION_REQUIRED"
      : "WAITING_ADMIN";

  const stage2Done = pickupConfigured && facts.activeInventoryLocations > 0;
  const stage2Status: StoreOnboardingStageStatus = stage2Done
    ? "COMPLETE"
    : pickupConfigured || facts.activeInventoryLocations > 0
      ? "IN_PROGRESS"
      : "ACTION_REQUIRED";

  const stage3Done = facts.sellableOffers > 0 && facts.liveStorefrontProducts > 0;
  const stage3Status: StoreOnboardingStageStatus = stage3Done
    ? "COMPLETE"
    : facts.draftOrActiveProducts === 0
      ? "ACTION_REQUIRED"
      : facts.sellableOffers > 0
        ? "IN_PROGRESS"
        : facts.approvedProducts > 0
          ? "ACTION_REQUIRED"
          : "IN_PROGRESS";

  const stage4Done = readyForCheckout;
  const stage4Status: StoreOnboardingStageStatus = stage4Done
    ? "COMPLETE"
    : ownerActionBlockers.length > 0
      ? "ACTION_REQUIRED"
      : "WAITING_ADMIN";

  const stages: StoreOnboardingStage[] = [
    {
      id: "account_identity",
      order: 1,
      title: "Business account & legal seller identity",
      status: stage1Status,
      summary: stage1Done
        ? "Business account active and legal seller identity approved."
        : facts.sellerIdentityStatus === "NOT_STARTED" || facts.sellerIdentityStatus === "REJECTED"
          ? "Submit your legal owner name, optional trading name, VAT status, and private supporting document."
          : "Waiting for KT Couriers administrator review.",
      items: [
        {
          label: "Store account status",
          done: facts.storeStatus === "ACTIVE",
          detail:
            facts.storeStatus === "ACTIVE"
              ? "Active"
              : facts.storeStatus === "PENDING"
                ? "Pending admin approval (you can continue onboarding below)"
                : facts.storeStatus,
        },
        {
          label: "Legal seller identity",
          done: facts.hasApprovedSellerIdentity,
          detail: facts.hasApprovedSellerIdentity
            ? "Approved"
            : facts.sellerIdentityStatus === "PENDING_REVIEW"
              ? "Submitted — awaiting independent admin review"
              : facts.sellerIdentityStatus === "REJECTED"
                ? "Needs correction & resubmission"
                : "Not submitted yet",
        },
      ],
      actionLabel: facts.hasApprovedSellerIdentity
        ? "View seller identity"
        : facts.sellerIdentityStatus === "PENDING_REVIEW"
          ? "Review submitted identity"
          : "Submit legal seller identity",
      actionHref: "/store/profile#seller-identity",
    },
    {
      id: "pickup_inventory",
      order: 2,
      title: "Collection address & stock locations",
      status: stage2Status,
      summary: stage2Done
        ? "Verified South African pickup point and active stock location recorded."
        : "Save your collection street address with map coordinates and create at least one stock location.",
      items: [
        {
          label: "Collection address & map pin",
          done: pickupConfigured,
          detail: pickupConfigured
            ? "Complete (street, suburb, city, province, postal code & GPS pin)"
            : pickupMissing.join("; ") || "Incomplete",
        },
        {
          label: "Active inventory locations",
          done: facts.activeInventoryLocations > 0,
          detail:
            facts.activeInventoryLocations > 0
              ? `${facts.activeInventoryLocations} active location${facts.activeInventoryLocations === 1 ? "" : "s"}`
              : "None created yet",
        },
      ],
      actionLabel: !pickupConfigured
        ? "Set collection address & pin"
        : "Manage inventory locations",
      actionHref: !pickupConfigured
        ? "/store/profile#pickup-address"
        : "/store/catalog/inventory",
    },
    {
      id: "first_product",
      order: 3,
      title: "First sellable product, ZAR price, stock & packaging",
      status: stage3Status,
      summary: stage3Done
        ? `${facts.sellableOffers} sellable offer${facts.sellableOffers === 1 ? "" : "s"} active with stock and packaging verified.`
        : "Create at least one product with approved media, package dimensions, ZAR price, and available stock > 0.",
      items: [
        {
          label: "Product drafts & catalog approvals",
          done: facts.approvedProducts > 0,
          detail: `${facts.draftOrActiveProducts} created · ${facts.approvedProducts} approved`,
        },
        {
          label: "Sellable offer (ZAR price + available stock + packaging)",
          done: facts.sellableOffers > 0,
          detail:
            facts.sellableOffers > 0
              ? `${facts.sellableOffers} checkout-ready offer${facts.sellableOffers === 1 ? "" : "s"}`
              : "Needs published offer with active ZAR price, stock > 0, and parcel dimensions",
        },
        {
          label: "Public storefront projection",
          done: facts.liveStorefrontProducts > 0,
          detail:
            facts.liveStorefrontProducts > 0
              ? `${facts.liveStorefrontProducts} indexed for public shop`
              : "Publishes once offer & store are active",
        },
      ],
      actionLabel:
        facts.draftOrActiveProducts === 0
          ? "Add first product"
          : facts.approvedProducts === 0
            ? "Manage products"
            : "Manage offers & stock",
      actionHref:
        facts.draftOrActiveProducts === 0
          ? "/store/catalog/products/new"
          : facts.approvedProducts === 0
            ? "/store/catalog/products"
            : "/store/catalog/offers",
    },
    {
      id: "commercial_certification",
      order: 4,
      title: "Commercial policies & live checkout certification",
      status: stage4Status,
      summary: stage4Done
        ? "Independently certified with current commercial & route policies."
        : "KT Couriers administrators configure commission/operational terms and certify real sellable-offer checkout readiness.",
      items: [
        {
          label: "Marketplace operational policy",
          done: facts.hasActiveOperationalPolicy,
          detail: facts.hasActiveOperationalPolicy ? "Active" : "Awaiting admin configuration",
        },
        {
          label: "Store commission agreement",
          done: facts.hasActiveCommissionPlan,
          detail: facts.hasActiveCommissionPlan ? "Active" : "Awaiting admin approval",
        },
        {
          label: "Two-person checkout certification",
          done: readyForCheckout,
          detail: readyForCheckout
            ? `Certified (${facts.certification?.proofOfferReference ?? "verified offer"})`
            : facts.certification?.status === "PENDING_REVIEW"
              ? "Prepared — awaiting second admin approval"
              : "Awaiting route & sellable-offer verification",
        },
      ],
      actionLabel: "Request admin review / support",
      actionHref: "/store/support",
    },
  ];

  // Deterministic priority next action
  let nextAction: StoreOnboardingNextAction;
  if (readyForCheckout) {
    nextAction = {
      label: "View public shop listing",
      description: "Your store is live. Add more products or manage daily fulfilment orders.",
      href: "/store/catalog/products/new",
      actor: "NONE",
    };
  } else if (
    facts.sellerIdentityStatus === "NOT_STARTED" ||
    facts.sellerIdentityStatus === "REJECTED"
  ) {
    nextAction = {
      label:
        facts.sellerIdentityStatus === "REJECTED"
          ? "Resubmit legal seller identity"
          : "Submit legal seller identity",
      description:
        "Upload your verification document and submit your legal owner/trading details in Store settings.",
      href: "/store/profile#seller-identity",
      actor: "OWNER",
    };
  } else if (!pickupConfigured) {
    nextAction = {
      label: "Save collection address & map pin",
      description:
        pickupMissing[0] ??
        "Complete your South African pickup street, suburb, postal code, and map coordinates.",
      href: "/store/profile#pickup-address",
      actor: "OWNER",
    };
  } else if (facts.activeInventoryLocations === 0) {
    nextAction = {
      label: "Create an inventory location",
      description: "Add at least one active stock location before recording opening stock.",
      href: "/store/catalog/inventory",
      actor: "OWNER",
    };
  } else if (facts.draftOrActiveProducts === 0) {
    nextAction = {
      label: "Create your first product",
      description: "Draft your first product with photos, package dimensions, ZAR price, and stock.",
      href: "/store/catalog/products/new",
      actor: "OWNER",
    };
  } else if (facts.sellableOffers === 0) {
    nextAction = {
      label:
        facts.approvedProducts === 0
          ? "Finish & submit product for review"
          : "Activate offer stock & price",
      description:
        facts.approvedProducts === 0
          ? "Confirm product photos, packaging dimensions, and submit your product for moderation."
          : "Verify your offer has active ZAR pricing, positive available stock, and valid packaging.",
      href:
        facts.approvedProducts === 0
          ? "/store/catalog/products"
          : "/store/catalog/offers",
      actor: "OWNER",
    };
  } else {
    nextAction = {
      label: "Awaiting KT Couriers admin approval",
      description:
        "All owner prerequisites look complete. An administrator will verify commercial policies and certify checkout.",
      href: "/store/support",
      actor: "ADMIN",
    };
  }

  return {
    storePublicReference: facts.storePublicReference,
    storeName: facts.storeName,
    storeSlug: facts.storeSlug,
    storeStatus: facts.storeStatus,
    shopState,
    shopStateLabel: SHOP_STATE_META[shopState].label,
    shopStateTone: SHOP_STATE_META[shopState].tone,
    shopStateSummary,
    readyForCheckout,
    blockers: uniqueBlockers,
    ownerActionBlockers,
    adminReviewBlockers,
    nextAction,
    metrics: {
      activeInventoryLocations: facts.activeInventoryLocations,
      draftOrActiveProducts: facts.draftOrActiveProducts,
      approvedProducts: facts.approvedProducts,
      publishedOffers: facts.publishedOffers,
      sellableOffers: facts.sellableOffers,
      liveStorefrontProducts: facts.liveStorefrontProducts,
    },
    stages,
  };
}

export async function getStoreOnboardingByStoreId(
  storeId: string,
): Promise<StoreOnboardingProjection | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      commerceReadinessRevision: true,
      defaultPickupAddress: true,
      savedAddresses: { where: { type: "PICKUP" } },
    },
  });
  if (!store) return null;

  const now = new Date();
  const [
    identityState,
    activeInventoryLocations,
    draftOrActiveProducts,
    approvedProducts,
    publishedOffers,
    pausedOrOutOfStockOffers,
    sellableOffersList,
    liveStorefrontProducts,
    certification,
    approvedSellerIdentityRow,
    operationalPolicy,
    commissionPlan,
    storefrontStoreDoc,
    currentGlobalPolicyRevision,
  ] = await Promise.all([
    getStoreSellerIdentityState(store.id),
    prisma.inventoryLocation.count({ where: { storeId: store.id, status: "ACTIVE" } }),
    prisma.catalogProduct.count({ where: { sourceStoreId: store.id } }),
    prisma.catalogProduct.count({
      where: { sourceStoreId: store.id, status: "ACTIVE", moderationStatus: "APPROVED" },
    }),
    prisma.storeCatalogOffer.count({
      where: { storeId: store.id, status: "ACTIVE", publicationStatus: "PUBLISHED" },
    }),
    prisma.storeCatalogOffer.count({
      where: { storeId: store.id, status: { in: ["PAUSED", "OUT_OF_STOCK"] } },
    }),
    selectEligibleSellableOffersForStore(prisma, store.id, now),
    prisma.storefrontProductDocument.count({
      where: { storeId: store.id, status: "ACTIVE", searchable: true },
    }),
    prisma.storeCheckoutCertification.findUnique({
      where: { storeId: store.id },
      select: {
        status: true,
        evidenceType: true,
        pickupAddressId: true,
        pickupFingerprint: true,
        preparedByUserId: true,
        approvedByUserId: true,
        approvedAt: true,
        expiresAt: true,
        routeEvidenceDigest: true,
        checkoutEvidenceDigest: true,
        engineProofDigest: true,
        proofOfferReference: true,
        proofPriceVersionReference: true,
        sourceCommerceReadinessRevision: true,
        globalPolicyRevision: true,
      },
    }),
    prisma.storeSellerLegalIdentity.findFirst({
      where: {
        storeId: store.id,
        status: "APPROVED",
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
      select: { status: true, effectiveFrom: true, effectiveUntil: true },
    }),
    prisma.storeOrderOperationalPolicy.findFirst({
      where: {
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      },
      orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
      select: { status: true, effectiveFrom: true, effectiveUntil: true },
    }),
    prisma.commissionPlan.findFirst({
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
    }),
    prisma.storefrontStoreDocument.findUnique({
      where: { storeId: store.id },
      select: { publicStatus: true },
    }),
    getGlobalCommercePolicyRevision(prisma),
  ]);

  const pickup = selectStorePickupCandidate(
    store.id,
    store.defaultPickupAddress,
    store.savedAddresses,
  );
  const hasApprovedSellerIdentity = isStoreSellerIdentityEffective(
    approvedSellerIdentityRow,
    now,
  );
  const latestProposal = identityState.proposals[0];
  let sellerIdentityStatus: StoreOnboardingFacts["sellerIdentityStatus"] = "NOT_STARTED";
  if (hasApprovedSellerIdentity) {
    sellerIdentityStatus = "APPROVED";
  } else if (latestProposal?.status === "PENDING_REVIEW") {
    sellerIdentityStatus = "PENDING_REVIEW";
  } else if (latestProposal?.status === "REJECTED") {
    sellerIdentityStatus = "REJECTED";
  }

  return deriveStoreOnboardingProjection({
    storePublicReference: store.slug,
    storeName: store.name,
    storeSlug: store.slug,
    storeStatus: store.status,
    storeCommerceReadinessRevision: store.commerceReadinessRevision ?? 0,
    currentGlobalPolicyRevision,
    hasApprovedSellerIdentity,
    sellerIdentityStatus,
    pickup,
    activeInventoryLocations,
    draftOrActiveProducts,
    approvedProducts,
    publishedOffers,
    pausedOrOutOfStockOffers,
    sellableOffers: sellableOffersList.length,
    liveStorefrontProducts,
    hasActiveOperationalPolicy: isStoreOperationalPolicyEffective(
      operationalPolicy,
      now,
    ),
    hasActiveCommissionPlan: Boolean(commissionPlan),
    certification,
    storefrontPublicStatus: storefrontStoreDoc?.publicStatus ?? null,
    now,
  });
}
