import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: vi.fn(), cert: vi.fn(), upsert: vi.fn(), update: vi.fn(), audit: vi.fn(),
  lock: vi.fn(), rebuild: vi.fn(), preflight: vi.fn(),
  globalRevision: vi.fn(), eligibleOffers: vi.fn(), commissionReadiness: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => {
  const tx = {
    $queryRaw: mocks.lock,
    store: { findUnique: mocks.store },
    storeCheckoutCertification: { findUnique: mocks.cert, upsert: mocks.upsert, update: mocks.update },
    adminActivityLog: { create: mocks.audit },
  };
  return { prisma: { store: tx.store, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("@/lib/admin/store-pickup-preflight.service", () => ({ getStorePickupOperationalPreflight: mocks.preflight }));
vi.mock("@/lib/services/storefront-store.service", () => ({ rebuildStorefrontStoreDocument: mocks.rebuild }));
vi.mock("@/lib/admin/commerce-readiness-revision", () => ({ getGlobalCommercePolicyRevision: mocks.globalRevision }));
vi.mock("@/lib/admin/store-sellable-offer-proof", () => ({ selectEligibleSellableOffersForStore: mocks.eligibleOffers }));
vi.mock("@/lib/admin/store-commission-readiness", () => ({ getStoreCommissionReadiness: mocks.commissionReadiness }));

import {
  approveStoreCheckoutCertification,
  currentStoreCertificationFacts,
  prepareStoreCheckoutCertification,
  REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
  STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
} from "@/lib/admin/store-checkout-certification.service";

const pickup = { id: "pickup", storeId: "store", type: "PICKUP", isDefault: true,
  line1: "10 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng",
  postalCode: "2196", country: "South Africa", latitude: -26.1, longitude: 28.05 };
const evidence = { routeEvidenceReference: "real-route-ref-123", checkoutEvidenceReference: "real-checkout-ref-123",
  routeEvidenceDigest: "a".repeat(64), checkoutEvidenceDigest: "b".repeat(64), reviewNote: "Evidence reviewed for delivery route and paid checkout" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.mockResolvedValue({ status: "ACTIVE", commerceReadinessRevision: 1, defaultPickupAddress: pickup, savedAddresses: [pickup] });
  mocks.preflight.mockResolvedValue({ blockers: [], pickupRegionId: "jhb", matchingServiceVersions: ["service-1:1"] });
  mocks.cert.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue({ id: "cert", status: "PENDING_REVIEW", revision: 0, expiresAt: new Date(Date.now() + 86400000) });
  mocks.globalRevision.mockResolvedValue(1);
  mocks.eligibleOffers.mockResolvedValue([{ offerReference: "COF-PROOF-1", priceVersionReference: "CPV-PROOF-1" }]);
  mocks.commissionReadiness.mockResolvedValue({ ready: true });
});

describe("certification recovery for existing stores", () => {
  it("accepts evidence for an existing active store without publishing it", async () => {
    expect((await prepareStoreCheckoutCertification("store", "preparer", evidence)).status).toBe("PENDING_REVIEW");
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it("rejects suspended stores", async () => {
    mocks.store.mockResolvedValue({ status: "SUSPENDED", commerceReadinessRevision: 1, defaultPickupAddress: pickup, savedAddresses: [pickup] });
    await expect(prepareStoreCheckoutCertification("store", "preparer", evidence)).rejects.toMatchObject({ code: "STORE_PICKUP_CHANGED" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("requires a different reviewer and rebuilds visibility after approval", async () => {
    const facts = await currentStoreCertificationFacts("store");
    mocks.cert.mockResolvedValue({
      ...facts,
      id: "cert",
      status: "PENDING_REVIEW",
      revision: 0,
      preparedByUserId: "preparer",
      expiresAt: new Date(Date.now() + 86400000),
      evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
      routeEvidenceDigest: evidence.routeEvidenceDigest,
      checkoutEvidenceDigest: evidence.checkoutEvidenceDigest,
      engineProofSuiteSha: STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
      engineProofDigest: "c".repeat(64),
      policyFingerprint: "d".repeat(64),
      sourceCommerceReadinessRevision: 1,
      globalPolicyRevision: 1,
      proofOfferReference: "COF-PROOF-1",
      proofPriceVersionReference: "CPV-PROOF-1",
    });
    await expect(approveStoreCheckoutCertification("store", "preparer", 0)).rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });
    expect(mocks.rebuild).not.toHaveBeenCalled();
    mocks.update.mockResolvedValue({ id: "cert", status: "APPROVED", revision: 1, expiresAt: new Date(Date.now() + 86400000) });
    expect((await approveStoreCheckoutCertification("store", "reviewer", 0)).status).toBe("APPROVED");
    expect(mocks.rebuild).toHaveBeenCalledOnce();
  });
});
