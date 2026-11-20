import { describe, expect, it } from "vitest";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";
import type { StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";
import {
  deriveStoreOnboardingProjection,
  isStoreOnboardingOwnerOfferPrepared,
  type StoreOnboardingOwnerOfferFacts,
  type StoreOnboardingFacts,
} from "@/lib/services/store-onboarding.service";

const now = new Date("2026-11-15T12:00:00.000Z");

const validPickup = {
  id: "pickup-ok",
  storeId: "store-1",
  type: "PICKUP",
  isDefault: true,
  line1: "123 Nelson Mandela Square",
  line2: "Sandton",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2196",
  country: "South Africa",
  placeId: "place-sandton",
  latitude: -26.1076,
  longitude: 28.0567,
} satisfies StorePickupAddressCandidate;

const baseFacts = (
  overrides: Partial<StoreOnboardingFacts> = {},
): StoreOnboardingFacts => ({
  storePublicReference: "pammy-bakes",
  storeName: "Pammy Bakes",
  storeSlug: "pammy-bakes",
  storeStatus: "PENDING",
  storeCommerceReadinessRevision: 1,
  currentGlobalPolicyRevision: 1,
  hasApprovedSellerIdentity: false,
  sellerIdentityStatus: "NOT_STARTED",
  pickup: null,
  activeInventoryLocations: 0,
  draftOrActiveProducts: 0,
  approvedProducts: 0,
  editableProducts: 0,
  pendingProductReviews: 0,
  editableOffers: 0,
  pendingOfferReviews: 0,
  approvedOffersAwaitingPublication: 0,
  ownerPreparedOffers: 0,
  publishedOffers: 0,
  pausedOrOutOfStockOffers: 0,
  sellableOffers: 0,
  liveStorefrontProducts: 0,
  hasActiveOperationalPolicy: false,
  hasActiveCommissionPlan: false,
  certification: null,
  storefrontPublicStatus: null,
  now,
  ...overrides,
});

describe("store onboarding 5-state projection", () => {
  it("keeps PENDING accounts in ACCOUNT_APPLICATION while allowing owner setup actions", () => {
    const res = deriveStoreOnboardingProjection(baseFacts());
    expect(res.shopState).toBe("ACCOUNT_APPLICATION");
    expect(res.shopStateLabel).toBe("Account application");
    expect(res.readyForCheckout).toBe(false);
    expect(res.nextAction.actor).toBe("OWNER");
    expect(res.nextAction.href).toBe("/store/profile#seller-identity");
    expect(res.stages).toHaveLength(4);
  });

  it("shows ACCOUNT_APPROVED when ACTIVE store has not started any shop setup", () => {
    const res = deriveStoreOnboardingProjection(
      baseFacts({ storeStatus: "ACTIVE" }),
    );
    expect(res.shopState).toBe("ACCOUNT_APPROVED");
    expect(res.shopStateLabel).toBe("Account approved");
    expect(res.readyForCheckout).toBe(false);
  });

  it("shows GETTING_SHOP_READY when ACTIVE store started setup and advances nextAction to missing stage", () => {
    const res = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
      }),
    );
    expect(res.shopState).toBe("GETTING_SHOP_READY");
    expect(res.shopStateLabel).toBe("Getting shop ready");
    expect(res.nextAction.actor).toBe("OWNER");
    expect(res.nextAction.href).toBe("/store/catalog/products/new");
  });

  it("shows WAITING_ADMIN when all owner steps are complete and admin review/certification remains", () => {
    const res = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
        draftOrActiveProducts: 1,
        approvedProducts: 1,
        publishedOffers: 1,
        sellableOffers: 1,
        liveStorefrontProducts: 1,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: false,
      }),
    );
    expect(res.shopState).toBe("GETTING_SHOP_READY");
    expect(res.ownerActionBlockers).toEqual([]);
    expect(res.adminReviewBlockers.length).toBeGreaterThanOrEqual(2);
    expect(res.nextAction.actor).toBe("ADMIN");
  });

  it("shows SHOP_LIVE only when active store satisfies full certification, revision parity, and sellable offer proof", () => {
    const digest = "a".repeat(64);
    const res = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
        draftOrActiveProducts: 1,
        approvedProducts: 1,
        publishedOffers: 1,
        sellableOffers: 1,
        liveStorefrontProducts: 1,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: true,
        certification: {
          status: "APPROVED",
          evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
          pickupAddressId: validPickup.id,
          pickupFingerprint: pickupCertificationFingerprint(validPickup),
          preparedByUserId: "admin-1",
          approvedByUserId: "admin-2",
          approvedAt: new Date("2026-11-15T10:00:00.000Z"),
          expiresAt: new Date("2026-12-15T10:00:00.000Z"),
          routeEvidenceDigest: digest,
          checkoutEvidenceDigest: digest,
          engineProofDigest: digest,
          proofOfferReference: "CO-LIVE1",
          proofPriceVersionReference: "CPR-LIVE1",
          sourceCommerceReadinessRevision: 1,
          globalPolicyRevision: 1,
        },
      }),
    );
    expect(res.shopState).toBe("SHOP_LIVE");
    expect(res.shopStateLabel).toBe("Shop LIVE");
    expect(res.readyForCheckout).toBe(true);
    expect(res.blockers).toEqual([]);
  });

  it("shows SHOP_PAUSED when approved certification becomes stale after readiness revision change or suspension", () => {
    const digest = "b".repeat(64);
    const stale = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        storeCommerceReadinessRevision: 2,
        currentGlobalPolicyRevision: 1,
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
        draftOrActiveProducts: 1,
        approvedProducts: 1,
        publishedOffers: 1,
        sellableOffers: 1,
        liveStorefrontProducts: 1,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: true,
        certification: {
          status: "APPROVED",
          evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
          pickupAddressId: validPickup.id,
          pickupFingerprint: pickupCertificationFingerprint(validPickup),
          preparedByUserId: "admin-1",
          approvedByUserId: "admin-2",
          approvedAt: new Date("2026-11-15T10:00:00.000Z"),
          expiresAt: new Date("2026-12-15T10:00:00.000Z"),
          routeEvidenceDigest: digest,
          checkoutEvidenceDigest: digest,
          engineProofDigest: digest,
          proofOfferReference: "CO-LIVE1",
          proofPriceVersionReference: "CPR-LIVE1",
          sourceCommerceReadinessRevision: 1,
          globalPolicyRevision: 1,
        },
      }),
    );
    expect(stale.shopState).toBe("SHOP_PAUSED");
    expect(stale.shopStateLabel).toBe("Shop paused");
    expect(stale.readyForCheckout).toBe(false);

    const suspended = deriveStoreOnboardingProjection(
      baseFacts({ storeStatus: "SUSPENDED" }),
    );
    expect(suspended.shopState).toBe("SHOP_PAUSED");
  });

  it("separates approved draft products from published storefront listings", () => {
    const result = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
        draftOrActiveProducts: 3,
        approvedProducts: 1,
        editableProducts: 2,
        approvedOffersAwaitingPublication: 1,
      }),
    );

    expect(result.ownerActionBlockers).toHaveLength(1);
    expect(result.ownerActionBlockers[0]).not.toContain("submit at least one");
    expect(result.ownerActionBlockers[0]).toContain("Do not resubmit it");
    expect(result.adminReviewBlockers.join(" ")).toContain(
      "independently approved offer",
    );
    expect(result.adminReviewBlockers.join(" ")).not.toContain(
      "Catalog moderation & publication approval",
    );
    expect(result.nextAction.actor).toBe("OWNER");
  });

  it("hands a seller-ready submitted offer to KT review instead of asking the owner to repeat work", () => {
    const result = deriveStoreOnboardingProjection(
      baseFacts({
        storeStatus: "ACTIVE",
        hasApprovedSellerIdentity: true,
        sellerIdentityStatus: "APPROVED",
        pickup: validPickup,
        activeInventoryLocations: 1,
        draftOrActiveProducts: 1,
        pendingOfferReviews: 1,
        ownerPreparedOffers: 1,
      }),
    );

    expect(result.ownerActionBlockers).toEqual([]);
    expect(result.nextAction.actor).toBe("ADMIN");
    expect(result.nextAction.label).toContain("KT Couriers review");
    expect(result.adminReviewBlockers.join(" ")).toContain(
      "Independent catalog review",
    );
    expect(result.stages.find((stage) => stage.id === "first_product")?.status).toBe(
      "WAITING_ADMIN",
    );
  });
});

const preparedOfferFacts = (
  overrides: Partial<StoreOnboardingOwnerOfferFacts> = {},
): StoreOnboardingOwnerOfferFacts => ({
  isStoreOwnedProduct: true,
  productStatus: "APPROVED",
  productModerationStatus: "APPROVED",
  productTypeActive: true,
  categoryActive: true,
  variantStatus: "DRAFT",
  productMedia: [
    {
      role: "PRIMARY",
      variantId: null,
      assetStatus: "READY",
      privacyInspectionPassed: true,
      storageConfirmed: true,
      validated: true,
    },
  ],
  variantId: "variant-1",
  offerStatus: "SUBMITTED",
  fulfilmentMode: "COURIER_DELIVERY",
  minimumQuantity: 1,
  hasCurrentZarPrice: true,
  hasInventoryItem: true,
  inventoryTrackingMode: "TRACKED",
  allowBackorder: false,
  activeLocationAvailableStock: 3,
  hasPackageDeclaration: true,
  ...overrides,
});

describe("seller offer handoff readiness", () => {
  it("accepts complete seller evidence for independent KT review and publication", () => {
    expect(isStoreOnboardingOwnerOfferPrepared(preparedOfferFacts())).toBe(true);
  });

  it("requires publication-grade media, usable stock, price, and delivery package", () => {
    expect(
      isStoreOnboardingOwnerOfferPrepared(
        preparedOfferFacts({ activeLocationAvailableStock: 0 }),
      ),
    ).toBe(false);
    expect(
      isStoreOnboardingOwnerOfferPrepared(
        preparedOfferFacts({ hasPackageDeclaration: false }),
      ),
    ).toBe(false);
    expect(
      isStoreOnboardingOwnerOfferPrepared(
        preparedOfferFacts({ hasCurrentZarPrice: false }),
      ),
    ).toBe(false);
    expect(
      isStoreOnboardingOwnerOfferPrepared(
        preparedOfferFacts({
          productMedia: [
            {
              ...preparedOfferFacts().productMedia[0]!,
              role: "GALLERY",
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isStoreOnboardingOwnerOfferPrepared(
        preparedOfferFacts({ isStoreOwnedProduct: false }),
      ),
    ).toBe(false);
  });
});
