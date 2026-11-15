import { describe, expect, it } from "vitest";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";
import { isStorePubliclyCheckoutReady } from "@/lib/storefront/store-publication-readiness";

const pickup = {
  id: "pickup-one", storeId: "store-one", type: "PICKUP", line1: "12 Main Road",
  line2: "Sandton", city: "Johannesburg", province: "Gauteng", postalCode: "2196",
  country: "South Africa", placeId: "ChIJrealplace", latitude: -26.1, longitude: 28.05,
};
const now = new Date("2026-11-09T08:00:00Z");
const cert = {
  status: "APPROVED",
  evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
  pickupAddressId: pickup.id,
  pickupFingerprint: pickupCertificationFingerprint(pickup),
  preparedByUserId: "admin-one",
  approvedByUserId: "admin-two",
  approvedAt: new Date("2026-11-08T08:00:00Z"),
  expiresAt: new Date("2026-11-10T08:00:00Z"),
  routeEvidenceDigest: "a".repeat(64),
  checkoutEvidenceDigest: "b".repeat(64),
  engineProofDigest: "c".repeat(64),
  proofOfferReference: "OFF-TEST-1",
  proofPriceVersionReference: "PRC-TEST-1",
  sourceCommerceReadinessRevision: 2,
  globalPolicyRevision: 3,
};
const input = {
  status: "ACTIVE",
  name: "Ready store",
  documentsCount: 2,
  pickup,
  certification: cert,
  hasApprovedSellerIdentity: true,
  hasActiveOperationalPolicy: true,
  hasActiveCommissionPlan: true,
  storeCommerceReadinessRevision: 2,
  currentGlobalPolicyRevision: 3,
  now,
};

describe("publication demands the same independent checkout authority as store Live approval", () => {
  it("permits an active, stocked, complete and independently certified store", () => {
    expect(isStorePubliclyCheckoutReady(input)).toBe(true);
  });

  it("never publishes a legacy ACTIVE store merely because it has a pickup pin and products", () => {
    expect(isStorePubliclyCheckoutReady({ ...input, certification: null })).toBe(false);
  });

  it("fails closed when seller identity or operational policy booleans are omitted or unknown at runtime", () => {
    expect(
      isStorePubliclyCheckoutReady({
        ...input,
        hasApprovedSellerIdentity: undefined as unknown as boolean,
      }),
    ).toBe(false);
    expect(
      isStorePubliclyCheckoutReady({
        ...input,
        hasActiveOperationalPolicy: undefined as unknown as boolean,
      }),
    ).toBe(false);
  });

  it("rejects store readiness and reports blockers when approved seller identity or active operational policy is missing", () => {
    expect(
      isStorePubliclyCheckoutReady({
        ...input,
        hasApprovedSellerIdentity: false,
        hasActiveOperationalPolicy: true,
      }),
    ).toBe(false);
    expect(
      isStorePubliclyCheckoutReady({
        ...input,
        hasApprovedSellerIdentity: true,
        hasActiveOperationalPolicy: false,
      }),
    ).toBe(false);

    const missingIdentityBlockers = describeStoreCheckoutBlockers({
      status: "ACTIVE",
      name: "Ready store",
      publishedOfferCount: 2,
      pickup,
      certification: cert,
      hasApprovedSellerIdentity: false,
      hasActiveOperationalPolicy: true,
      hasActiveCommissionPlan: true,
      storeCommerceReadinessRevision: 2,
      currentGlobalPolicyRevision: 3,
      now,
    });
    expect(missingIdentityBlockers).toContain("Approved legal seller identity missing or expired");

    const missingPolicyBlockers = describeStoreCheckoutBlockers({
      status: "ACTIVE",
      name: "Ready store",
      publishedOfferCount: 2,
      pickup,
      certification: cert,
      hasApprovedSellerIdentity: true,
      hasActiveOperationalPolicy: false,
      hasActiveCommissionPlan: true,
      storeCommerceReadinessRevision: 2,
      currentGlobalPolicyRevision: 3,
      now,
    });
    expect(missingPolicyBlockers).toContain(
      "Active store order operational policy missing or expired",
    );
  });

  it.each([
    { status: "PENDING_REVIEW" }, { status: "REVOKED" }, { approvedByUserId: null },
    { approvedByUserId: "admin-one" }, { approvedAt: null },
    { expiresAt: new Date("2026-11-09T08:00:00Z") },
    { evidenceType: "SAVEPOINT_SYNTHETIC" }, { evidenceType: null },
    { engineProofDigest: null }, { engineProofDigest: "bad" },
    { proofOfferReference: null }, { proofPriceVersionReference: null },
    { sourceCommerceReadinessRevision: 1 }, { globalPolicyRevision: 2 },
    { routeEvidenceDigest: null }, { checkoutEvidenceDigest: "invalid" },
    { pickupAddressId: "old-pickup" }, { pickupFingerprint: "bad" },
  ])("rejects invalid, stale, synthetic or self-approved receipt: %o", patch => {
    expect(isStorePubliclyCheckoutReady({ ...input, certification: { ...cert, ...patch } })).toBe(false);
  });

  it("prevents stale, uncommitted commission plan, revision drift or incomplete facts from being advertised", () => {
    expect(isStorePubliclyCheckoutReady({ ...input, status: "PENDING" })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, documentsCount: 0 })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, hasActiveCommissionPlan: false })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, storeCommerceReadinessRevision: 3 })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, currentGlobalPolicyRevision: 4 })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, pickup: { ...pickup, line2: null } })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, pickup: { ...pickup, latitude: null } })).toBe(false);
    expect(isStorePubliclyCheckoutReady({ ...input, pickup: { ...pickup, storeId: "another-store" } })).toBe(false);
  });
});
