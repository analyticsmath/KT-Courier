import { describe, expect, it } from "vitest";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";
import { isStorePubliclyCheckoutReady } from "@/lib/storefront/store-publication-readiness";

const pickup = {
  id: "addr-1",
  storeId: "store-1",
  type: "PICKUP",
  line1: "100 Commissioner St",
  suburb: "Marshalltown",
  city: "Johannesburg",
  province: "Gauteng",
  postalCode: "2001",
  country: "ZA",
  latitude: -26.2041,
  longitude: 28.0473,
  placeId: "place-jhb-1",
};

const now = new Date("2026-11-27T08:00:00.000Z");

function makeCert(overrides: Record<string, unknown> = {}) {
  return {
    status: "APPROVED",
    evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
    pickupAddressId: pickup.id,
    pickupFingerprint: pickupCertificationFingerprint(pickup),
    preparedByUserId: "admin-1",
    approvedByUserId: "admin-2",
    approvedAt: new Date("2026-11-26T10:00:00.000Z"),
    expiresAt: new Date("2026-12-26T10:00:00.000Z"),
    routeEvidenceDigest: "a".repeat(64),
    checkoutEvidenceDigest: "b".repeat(64),
    engineProofDigest: "c".repeat(64),
    proofOfferReference: "OFFER-1",
    proofPriceVersionReference: "PRICE-1",
    proofMetadata: { qaAcceptanceOnly: true },
    sourceCommerceReadinessRevision: 2,
    globalPolicyRevision: 3,
    ...overrides,
  };
}

describe("QA demonstration certification non-eligibility", () => {
  it("rejects qaAcceptanceOnly certification for genuine commercial storefronts", () => {
    const qaCert = makeCert({ proofMetadata: { qaAcceptanceOnly: true } });

    expect(
      isStorePubliclyCheckoutReady({
        status: "ACTIVE",
        name: "Commercial Merchant",
        documentsCount: 2,
        pickup,
        certification: qaCert,
        hasApprovedSellerIdentity: true,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: true,
        storeCommerceReadinessRevision: 2,
        currentGlobalPolicyRevision: 3,
        isQaAcceptanceStore: false,
        now,
      }),
    ).toBe(false);

    const blockers = describeStoreCheckoutBlockers({
      status: "ACTIVE",
      name: "Commercial Merchant",
      publishedOfferCount: 2,
      pickup,
      certification: qaCert,
      hasApprovedSellerIdentity: true,
      hasActiveOperationalPolicy: true,
      hasActiveCommissionPlan: true,
      storeCommerceReadinessRevision: 2,
      currentGlobalPolicyRevision: 3,
      isQaAcceptanceStore: false,
      now,
    });
    expect(blockers).toContain("QA-only sandbox certification cannot qualify a commercial store");
  });

  it("allows qaAcceptanceOnly certification only when explicitly evaluated for an isolated QA store", () => {
    const qaCert = makeCert({ proofMetadata: { qaAcceptanceOnly: true } });

    expect(
      isStorePubliclyCheckoutReady({
        status: "ACTIVE",
        name: "QA Acceptance Store",
        documentsCount: 2,
        pickup,
        certification: qaCert,
        hasApprovedSellerIdentity: true,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: true,
        storeCommerceReadinessRevision: 2,
        currentGlobalPolicyRevision: 3,
        isQaAcceptanceStore: true,
        now,
      }),
    ).toBe(true);
  });

  it("permits ordinary commercial certification when qaAcceptanceOnly is absent", () => {
    const commercialCert = makeCert({ proofMetadata: { offerReference: "OFFER-1" } });

    expect(
      isStorePubliclyCheckoutReady({
        status: "ACTIVE",
        name: "Commercial Merchant",
        documentsCount: 2,
        pickup,
        certification: commercialCert,
        hasApprovedSellerIdentity: true,
        hasActiveOperationalPolicy: true,
        hasActiveCommissionPlan: true,
        storeCommerceReadinessRevision: 2,
        currentGlobalPolicyRevision: 3,
        isQaAcceptanceStore: false,
        now,
      }),
    ).toBe(true);
  });
});
