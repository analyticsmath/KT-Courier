import { describe, expect, it } from "vitest";
import { pickupCertificationFingerprint } from "@/lib/admin/store-checkout-certification.service";
import { describeStoreCheckoutBlockers } from "@/lib/admin/store-checkout-blockers";
import { REAL_CHECKOUT_PROOF_EVIDENCE_TYPE } from "@/lib/admin/store-checkout-proof-constants";

const pickup = {
  id: "pickup-1", storeId: "store-1", type: "PICKUP",
  line1: "15 Main Street", line2: "Sandton", city: "Johannesburg",
  province: "Gauteng", country: "ZA", postalCode: "2196",
  latitude: -26.1076, longitude: 28.0567, placeId: "verified-map-point",
};
const cert = {
  status: "APPROVED",
  evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
  pickupAddressId: "pickup-1",
  pickupFingerprint: pickupCertificationFingerprint(pickup),
  preparedByUserId: "admin-maker", approvedByUserId: "admin-reviewer",
  approvedAt: new Date("2026-11-09T08:00:00.000Z"),
  expiresAt: new Date("2026-11-10T08:00:00.000Z"),
  routeEvidenceDigest: "a".repeat(64), checkoutEvidenceDigest: "b".repeat(64),
  engineProofDigest: "c".repeat(64),
  proofOfferReference: "OFF-1",
  proofPriceVersionReference: "PRC-1",
  sourceCommerceReadinessRevision: 1,
  globalPolicyRevision: 1,
};
const base = {
  status: "ACTIVE",
  name: "Gauteng Merchant",
  publishedOfferCount: 2,
  pickup,
  certification: cert,
  hasApprovedSellerIdentity: true,
  hasActiveOperationalPolicy: true,
  hasActiveCommissionPlan: true,
  storeCommerceReadinessRevision: 1,
  currentGlobalPolicyRevision: 1,
  now: new Date("2026-11-09T12:00:00.000Z"),
};

describe("superuser store checkout-blocked inventory", () => {
  it("does not classify a current independently certified merchant as blocked", () => {
    expect(describeStoreCheckoutBlockers(base)).toEqual([]);
  });
  it("fails closed when seller identity or operational policy is false or omitted", () => {
    expect(describeStoreCheckoutBlockers({ ...base, hasApprovedSellerIdentity: false }))
      .toContain("Approved legal seller identity missing or expired");
    expect(describeStoreCheckoutBlockers({ ...base, hasActiveOperationalPolicy: false }))
      .toContain("Active store order operational policy missing or expired");
    expect(
      describeStoreCheckoutBlockers({
        ...base,
        hasApprovedSellerIdentity: undefined as unknown as boolean,
      }),
    ).toContain("Approved legal seller identity missing or expired");
    expect(
      describeStoreCheckoutBlockers({
        ...base,
        hasActiveOperationalPolicy: undefined as unknown as boolean,
      }),
    ).toContain("Active store order operational policy missing or expired");
  });
  it("reports the merchant's exact missing pickup fields", () => {
    const blockers = describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, line2: "", postalCode: "", latitude: null } });
    expect(blockers).toContain("Suburb / area missing");
    expect(blockers).toContain("Postal code missing");
    expect(blockers).toContain("Map coordinates missing");
  });
  it("includes stores with valid pickup but missing, expired or self-approved checkout authority", () => {
    expect(describeStoreCheckoutBlockers({ ...base, certification: null })).toContain("Independent route and checkout certification missing");
    expect(describeStoreCheckoutBlockers({ ...base, now: new Date("2026-11-10T09:00:00.000Z") })).toContain("Checkout certification expired");
    expect(describeStoreCheckoutBlockers({ ...base, certification: { ...cert, approvedByUserId: "admin-maker" } }))
      .toContain("Independent route and paid-checkout review incomplete");
  });
  it("does not declare an unlisted store ready when it has zero published products or a pending account", () => {
    expect(describeStoreCheckoutBlockers({ ...base, publishedOfferCount: 0 })).toContain("No published products available");
    expect(describeStoreCheckoutBlockers({ ...base, status: "PENDING" })).toContain("Store account needs activation");
  });
  it("detects changed collection locations without manufacturing fresh certification", () => {
    expect(describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, id: "new-pickup" } }))
      .toContain("Collection address changed since checkout certification");
    expect(describeStoreCheckoutBlockers({ ...base, pickup: { ...pickup, latitude: -26.2001 } }))
      .toContain("Reconfirm the saved pickup against current approved checkout evidence");
  });
  it("flags synthetic evidence, missing commission plan, and revision drift", () => {
    expect(describeStoreCheckoutBlockers({ ...base, hasActiveCommissionPlan: false }))
      .toContain("Active store commission plan missing or expired");
    expect(describeStoreCheckoutBlockers({ ...base, certification: { ...cert, evidenceType: "SAVEPOINT_SYNTHETIC" } }))
      .toContain("Real sellable-offer checkout proof required");
    expect(describeStoreCheckoutBlockers({ ...base, storeCommerceReadinessRevision: 2 }))
      .toContain("Store catalog, pricing, pickup, or commercial readiness changed since certification");
    expect(describeStoreCheckoutBlockers({ ...base, currentGlobalPolicyRevision: 2 }))
      .toContain("Platform delivery, tax, or operational policy changed since certification");
  });
});
