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
import { listCatalogPackagingForOffers } from "@/lib/services/catalog-packaging.service";
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
    editableProducts: number;
    pendingProductReviews: number;
    editableOffers: number;
    pendingOfferReviews: number;
    approvedOffersAwaitingPublication: number;
    ownerPreparedOffers: number;
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
  editableProducts: number;
  pendingProductReviews: number;
  editableOffers: number;
  pendingOfferReviews: number;
  approvedOffersAwaitingPublication: number;
  ownerPreparedOffers: number;
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

export interface StoreOnboardingOwnerOfferFacts {
  isStoreOwnedProduct: boolean;
  productStatus: string;
  productModerationStatus: string;
  productTypeActive: boolean;
  categoryActive: boolean;
  variantStatus: string;
  productMedia: ReadonlyArray<{
    role: string;
    variantId: string | null;
    assetStatus: string;
    privacyInspectionPassed: boolean;
    storageConfirmed: boolean;
    validated: boolean;
  }>;
  variantId: string;
  offerStatus: string;
  fulfilmentMode: string;
  minimumQuantity: number;
  hasCurrentZarPrice: boolean;
  hasInventoryItem: boolean;
  inventoryTrackingMode: string | null;
  allowBackorder: boolean;
  activeLocationAvailableStock: number;
  hasPackageDeclaration: boolean;
}

export function isStoreOnboardingOwnerOfferPrepared(
  offer: StoreOnboardingOwnerOfferFacts,
): boolean {
  if (!Number.isFinite(offer.minimumQuantity) || offer.minimumQuantity <= 0) {
    return false;
  }
  const productSubmittedOrApproved =
    offer.isStoreOwnedProduct &&
    offer.productTypeActive &&
    offer.categoryActive &&
    offer.variantStatus === "DRAFT" &&
    ((offer.productStatus === "SUBMITTED" &&
      ["PENDING", "UNDER_REVIEW"].includes(offer.productModerationStatus)) ||
      (["APPROVED", "ACTIVE"].includes(offer.productStatus) &&
        offer.productModerationStatus === "APPROVED"));
  const offerSubmitted = ["SUBMITTED", "ACTIVE"].includes(offer.offerStatus);
  const requiredQuantity = Math.max(1, Math.ceil(offer.minimumQuantity));
  const stockCanFulfil =
    offer.hasInventoryItem &&
    (offer.inventoryTrackingMode === "UNTRACKED" ||
      offer.inventoryTrackingMode === "MADE_TO_ORDER" ||
      offer.allowBackorder ||
      offer.activeLocationAvailableStock >= requiredQuantity);
  const deliveryPackageProvided =
    offer.fulfilmentMode === "STORE_PICKUP" || offer.hasPackageDeclaration;
  const hasOnePrimaryProductImage =
    offer.productMedia.filter(
      (media) => media.role === "PRIMARY" && media.variantId === null,
    ).length === 1;
  const hasPublicationReadyProductMedia =
    offer.productMedia.length > 0 &&
    offer.productMedia.every(
      (media) =>
        media.assetStatus === "READY" &&
        media.privacyInspectionPassed &&
        media.storageConfirmed &&
        media.validated,
    );

  return (
    productSubmittedOrApproved &&
    offerSubmitted &&
    offer.hasCurrentZarPrice &&
    stockCanFulfil &&
    deliveryPackageProvided &&
    hasOnePrimaryProductImage &&
    hasPublicationReadyProductMedia
  );
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
  if (facts.sellableOffers < 1 && facts.ownerPreparedOffers < 1) {
    if (facts.draftOrActiveProducts < 1) {
      ownerActionBlockers.push("Create your first product with photos, ZAR selling price, opening stock, and package dimensions.");
    } else if (facts.approvedOffersAwaitingPublication > 0) {
      ownerActionBlockers.push("Complete any remaining seller-controlled stock, current price, and delivery-package details on the independently approved offer. Do not resubmit it; KT Couriers handles publication after readiness checks pass.");
    } else if (
      (facts.approvedProducts < 1 && facts.editableProducts > 0) ||
      facts.editableOffers > 0
    ) {
      ownerActionBlockers.push("Finish product details/photos and submit at least one product and offer for independent review.");
    } else {
      ownerActionBlockers.push("Complete any missing price, fulfilment stock, required package, or approved product media details for at least one offer. KT Couriers handles independent review and publication after the seller submission is complete.");
    }
  }

  const adminReviewBlockers: string[] = [];
  if (facts.storeStatus === "PENDING") {
    adminReviewBlockers.push("Business account approval by KT Couriers administrator.");
  }
  if (!facts.hasApprovedSellerIdentity && facts.sellerIdentityStatus === "PENDING_REVIEW") {
    adminReviewBlockers.push("Independent review of your submitted legal seller identity.");
  }
  if (facts.pendingProductReviews > 0 || facts.pendingOfferReviews > 0) {
    const pendingReviews = [
      facts.pendingProductReviews > 0
        ? facts.pendingProductReviews + " product" + (facts.pendingProductReviews === 1 ? "" : "s")
        : "",
      facts.pendingOfferReviews > 0
        ? facts.pendingOfferReviews + " offer" + (facts.pendingOfferReviews === 1 ? "" : "s")
        : "",
    ].filter(Boolean);
    adminReviewBlockers.push(
      "Independent catalog review is waiting on submitted " +
        pendingReviews.join(" and ") +
        ".",
    );
  }
  if (facts.approvedOffersAwaitingPublication > 0) {
    const count = facts.approvedOffersAwaitingPublication;
    adminReviewBlockers.push(
      "KT Couriers publication is still required for " +
        count +
        " independently approved offer" +
        (count === 1 ? "" : "s") +
        " after seller readiness checks pass.",
    );
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
    : facts.ownerPreparedOffers > 0
      ? "WAITING_ADMIN"
      : facts.draftOrActiveProducts === 0
        ? "ACTION_REQUIRED"
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
        ? facts.sellableOffers + " sellable offer(s) are active with stock and packaging verified."
        : facts.ownerPreparedOffers > 0
          ? "Your product and offer details are submitted. KT Couriers handles independent review, publication, and final checkout certification."
          : "Complete product media, a current ZAR price, available stock, and required package details before the independent review and publication handoff.",
      items: [
        {
          label: "Product moderation",
          done: facts.approvedProducts > 0,
          detail:
            facts.draftOrActiveProducts +
            " created · " +
            facts.approvedProducts +
            " moderation approved · " +
            facts.pendingProductReviews +
            " awaiting review · " +
            facts.editableProducts +
            " editable draft(s)",
        },
        {
          label: "Offer review & publication",
          done: facts.sellableOffers > 0,
          detail:
            facts.sellableOffers > 0
              ? facts.sellableOffers + " published and checkout-ready"
              : facts.approvedOffersAwaitingPublication > 0
                ? facts.approvedOffersAwaitingPublication +
                  " independently approved; awaiting seller readiness checks and KT Couriers publication"
                : facts.pendingOfferReviews > 0
                  ? facts.pendingOfferReviews +
                    " submitted; awaiting independent KT Couriers review"
                  : "No offer has completed independent review and publication.",
        },
        {
          label: "Seller-supplied offer data",
          done: facts.ownerPreparedOffers > 0 || facts.sellableOffers > 0,
          detail:
            facts.ownerPreparedOffers > 0
              ? facts.ownerPreparedOffers +
                " offer(s) have submitted price, stock, and required package details"
              : "Required price, available stock, and package details are still being completed.",
        },
        {
          label: "Live offer (ZAR price + available stock + packaging)",
          done: facts.sellableOffers > 0,
          detail:
            facts.sellableOffers > 0
              ? facts.sellableOffers + " checkout-ready offer(s)"
              : "A reviewed offer must be published and pass current price, stock, and parcel checks.",
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
        facts.ownerPreparedOffers > 0
          ? "View submitted offers"
          : facts.draftOrActiveProducts === 0
            ? "Add first product"
            : facts.approvedOffersAwaitingPublication > 0
              ? "Complete approved offer readiness"
            : facts.editableOffers > 0
              ? "Manage offer drafts"
            : facts.approvedProducts > 0
              ? "Complete offer stock & packaging"
              : "Manage product drafts",
      actionHref:
        facts.draftOrActiveProducts === 0
          ? "/store/catalog/products/new"
          : facts.ownerPreparedOffers > 0 ||
              facts.editableOffers > 0 ||
              facts.approvedProducts > 0
            ? "/store/catalog/offers"
            : "/store/catalog/products",
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
  } else if (facts.ownerPreparedOffers > 0) {
    nextAction = {
      label: "Awaiting KT Couriers review & publication",
      description:
        "Your submitted product and offer details meet the seller handoff checks. KT Couriers must complete independent review and listing publication.",
      href: "/store/catalog/offers",
      actor: "ADMIN",
    };
  } else if (facts.sellableOffers === 0) {
    nextAction = {
      label:
        facts.approvedOffersAwaitingPublication > 0
          ? "Complete approved offer readiness"
          : facts.approvedProducts === 0
          ? "Finish & submit product for review"
          : "Activate offer stock & price",
      description:
        facts.approvedOffersAwaitingPublication > 0
          ? "Complete any remaining seller-controlled stock, current price, and package details. An approved offer goes to KT Couriers for publication after readiness checks; it does not need to be resubmitted."
          : facts.approvedProducts === 0
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
      editableProducts: facts.editableProducts,
      pendingProductReviews: facts.pendingProductReviews,
      editableOffers: facts.editableOffers,
      pendingOfferReviews: facts.pendingOfferReviews,
      approvedOffersAwaitingPublication: facts.approvedOffersAwaitingPublication,
      ownerPreparedOffers: facts.ownerPreparedOffers,
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
    editableProducts,
    pendingProductReviews,
    editableOffers,
    catalogOfferCandidates,
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
      where: {
        sourceStoreId: store.id,
        status: { in: ["APPROVED", "ACTIVE"] },
        moderationStatus: "APPROVED",
      },
    }),
    prisma.catalogProduct.count({
      where: {
        sourceStoreId: store.id,
        status: { in: ["DRAFT", "NEEDS_CHANGES"] },
      },
    }),
    prisma.catalogProduct.count({
      where: {
        sourceStoreId: store.id,
        status: "SUBMITTED",
        moderationStatus: { in: ["PENDING", "UNDER_REVIEW"] },
      },
    }),
    prisma.storeCatalogOffer.count({
      where: { storeId: store.id, status: { in: ["DRAFT", "NEEDS_CHANGES"] } },
    }),
    prisma.storeCatalogOffer.findMany({
      where: { storeId: store.id, status: { in: ["SUBMITTED", "ACTIVE"] } },
      select: {
        publicReference: true,
        status: true,
        approvedByUserId: true,
        publicationStatus: true,
        variantId: true,
        fulfilmentMode: true,
        minimumQuantity: true,
        product: {
          select: {
            scope: true,
            sourceStoreId: true,
            status: true,
            moderationStatus: true,
            productTypeDefinition: { select: { status: true } },
            primaryCategory: { select: { status: true } },
            media: {
              select: {
                role: true,
                variantId: true,
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
        variant: { select: { status: true } },
        priceVersions: {
          where: {
            status: { in: ["DRAFT", "ACTIVE"] },
            currency: "ZAR",
            amount: { gt: 0 },
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          select: { id: true },
          orderBy: [{ versionNumber: "desc" }, { id: "desc" }],
        },
        inventoryItem: {
          select: {
            trackingMode: true,
            allowBackorder: true,
            levels: {
              where: { location: { status: "ACTIVE" } },
              select: { available: true },
            },
          },
        },
      },
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

  const packageDeclarations = await listCatalogPackagingForOffers(
    store.id,
    catalogOfferCandidates
      .filter((offer) => offer.fulfilmentMode !== "STORE_PICKUP")
      .map((offer) => offer.publicReference),
  );
  const packageOfferReferences = new Set(
    packageDeclarations.map((declaration) => declaration.offerReference),
  );

  const pendingOfferReviews = catalogOfferCandidates.filter(
    (offer) => offer.status === "SUBMITTED" && !offer.approvedByUserId,
  ).length;
  const approvedOffersAwaitingPublication = catalogOfferCandidates.filter(
    (offer) =>
      offer.status === "SUBMITTED" &&
      Boolean(offer.approvedByUserId) &&
      offer.publicationStatus !== "PUBLISHED",
  ).length;
  const ownerPreparedOffers = catalogOfferCandidates.filter((offer) => {
      const inventory = offer.inventoryItem;
      return isStoreOnboardingOwnerOfferPrepared({
        isStoreOwnedProduct:
          offer.product.scope === "STORE_PRIVATE" &&
          offer.product.sourceStoreId === store.id,
        productStatus: offer.product.status,
        productModerationStatus: offer.product.moderationStatus,
        productTypeActive: offer.product.productTypeDefinition.status === "ACTIVE",
        categoryActive: offer.product.primaryCategory.status === "ACTIVE",
        variantStatus: offer.variant.status,
        productMedia: offer.product.media.map((media) => ({
          role: media.role,
          variantId: media.variantId,
          assetStatus: media.asset.status,
          privacyInspectionPassed: media.asset.privacyInspectionPassed,
          storageConfirmed: media.asset.storageConfirmedAt !== null,
          validated: media.asset.validatedAt !== null,
        })),
        variantId: offer.variantId,
        offerStatus: offer.status,
        fulfilmentMode: offer.fulfilmentMode,
        minimumQuantity: Number(offer.minimumQuantity),
        hasCurrentZarPrice: offer.priceVersions.length > 0,
        hasInventoryItem: Boolean(inventory),
        inventoryTrackingMode: inventory?.trackingMode ?? null,
        allowBackorder: inventory?.allowBackorder ?? false,
        activeLocationAvailableStock:
          inventory?.levels.reduce(
            (maxAvailable, level) => Math.max(maxAvailable, level.available),
            0,
          ) ?? 0,
        hasPackageDeclaration:
          offer.fulfilmentMode === "STORE_PICKUP" ||
          packageOfferReferences.has(offer.publicReference),
      });
    }).length;

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
    editableProducts,
    pendingProductReviews,
    editableOffers,
    pendingOfferReviews,
    approvedOffersAwaitingPublication,
    ownerPreparedOffers,
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
