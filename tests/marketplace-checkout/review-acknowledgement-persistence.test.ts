import { describe, expect, it, vi } from "vitest";
import { acknowledgeMarketplaceCheckoutReviewPersisted, reviewMarketplaceCheckout } from "@/lib/marketplace-checkout/checkout-review-persistence.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

const owner = { type: "CUSTOMER" as const, userId: "customer-1" };
const checkout = {
  id: "checkout-id", publicReference: "checkout-1", status: "VALIDATING", version: 2, reviewVersion: 1, currency: "ZAR", grandTotal: "10.00",
  commercialFingerprint: null, acceptedFingerprint: null, contactSnapshotId: "contact-1", addressSnapshotId: "address-1", addressServiceAreaReference: "area-1", sourceGroups: [{ id: "group-1", storeId: "store-1" }],
  settlementEvidenceVersions: ["settlement-evidence:v1:frozen"],
  groups: [{ storeReference: "store-1", pickupLocationReference: "pickup-1", fulfilmentMode: "COURIER_DELIVERY", lines: [{ lineReference: "line-1", storeReference: "store-1", offerReference: "offer-1", variantReference: "variant-1", quantity: 1, priceVersion: "price-1", publicationVersion: "pub-1", baseUnitPrice: "10.00", modifierUnitTotal: "0.00", lineTotal: "10.00" }] }],
};

describe("marketplace checkout review and acknowledgement persistence", () => {
  it("persists exact review snapshots and replays equal operations", async () => {
    const persistReview = vi.fn();
    const repository = { transaction: async (work: () => Promise<unknown>) => work(), lockCheckout: vi.fn().mockResolvedValue(checkout), findOperation: vi.fn().mockResolvedValue(null), freezeSettlementEvidence: vi.fn().mockResolvedValue({ commercialFingerprint: "frozen-fingerprint", evidence: [] }), persistReview };
    const result = await reviewMarketplaceCheckout(repository as never, {
      reference: "checkout-1", owner, operationId: "review-0001", requestHash: "same", expectedVersion: 2, commissionPolicyVersion: "plan-1",
      quoteAdapter: { quoteStoreGroup: async () => ({ fee: "5.00", currency: "ZAR", publicReference: "quote-1", version: "rule-1", expiresAt: new Date(Date.now() + 60_000), serviceabilityReference: "area-1", serviceLevel: "SAME_DAY" }) },
      resolveLine: async (line: any) => ({ lineReference: line?.lineReference ?? "line-1", available: true, quantity: 1, priceVersion: "price-1", publicationVersion: "pub-1", baseUnitPrice: "10.00", modifierUnitTotal: "0.00", lineTotal: "10.00", modifierValid: true }),
    });
    expect(result).toMatchObject({ status: "READY_FOR_REVIEW", grandTotal: "15.00", reviewVersion: 2 });
    expect(persistReview).toHaveBeenCalledOnce();
    repository.findOperation.mockResolvedValueOnce({ requestHash: "same", response: result });
    await expect(reviewMarketplaceCheckout(repository as never, { reference: "checkout-1", owner, operationId: "review-0001", requestHash: "same", expectedVersion: 2, commissionPolicyVersion: "plan-1", quoteAdapter: {} as never, resolveLine: async () => { throw new Error("not replayed"); } })).resolves.toEqual(result);
  });
  it("rejects changed operation meaning and stale acknowledgement", async () => {
    const reviewRepository = { transaction: async (work: () => Promise<unknown>) => work(), lockCheckout: vi.fn().mockResolvedValue(checkout), findOperation: vi.fn().mockResolvedValue({ requestHash: "first", response: {} }), freezeSettlementEvidence: vi.fn(), persistReview: vi.fn() };
    await expect(reviewMarketplaceCheckout(reviewRepository as never, { reference: "checkout-1", owner, operationId: "review-0001", requestHash: "other", expectedVersion: 2, commissionPolicyVersion: "plan-1", quoteAdapter: {} as never, resolveLine: async () => { throw new Error("not reached"); } })).rejects.toThrow();
    const acknowledgementRepository = { transaction: async (work: () => Promise<unknown>) => work(), lockCheckout: vi.fn().mockResolvedValue({ ...checkout, status: "READY_FOR_REVIEW", reviewVersion: 2, commercialFingerprint: "fingerprint", changes: [] }), findOperation: vi.fn().mockResolvedValue(null), createAcknowledgement: vi.fn() };
    await expect(acknowledgeMarketplaceCheckoutReviewPersisted(acknowledgementRepository as never, { reference: "checkout-1", owner, operationId: "ack-0001", requestHash: "ack", expectedVersion: 2, reviewVersion: 1, commercialFingerprint: "fingerprint", acknowledgedTotalReference: "15.00", termsVersion: "terms-1", privacyVersion: "privacy-1", refundPolicyReferences: ["refund-1"] })).rejects.toThrow();
  });
  it("fails the whole review before persistence when one store lacks frozen settlement evidence", async () => {
    const persistReview = vi.fn();
    const repository = { transaction: async (work: () => Promise<unknown>) => work(), lockCheckout: vi.fn().mockResolvedValue(checkout), findOperation: vi.fn().mockResolvedValue(null), freezeSettlementEvidence: vi.fn().mockRejectedValue(new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "missing seller settlement authority")), persistReview };
    await expect(reviewMarketplaceCheckout(repository as never, {
      reference: "checkout-1", owner, operationId: "review-evidence-missing", requestHash: "same", expectedVersion: 2, commissionPolicyVersion: "plan-1",
      quoteAdapter: { quoteStoreGroup: async () => ({ fee: "5.00", currency: "ZAR", publicReference: "quote-1", version: "rule-1", expiresAt: new Date(Date.now() + 60_000), serviceabilityReference: "area-1", serviceLevel: "SAME_DAY" }) },
      resolveLine: async (line: any) => ({ lineReference: line?.lineReference ?? "line-1", available: true, quantity: 1, priceVersion: "price-1", publicationVersion: "pub-1", baseUnitPrice: "10.00", modifierUnitTotal: "0.00", lineTotal: "10.00", modifierValid: true }),
    })).rejects.toMatchObject({ code: "SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE" });
    expect(persistReview).not.toHaveBeenCalled();
  });
  it("persists an exact acknowledgement after matching commercial evidence", async () => {
    const createAcknowledgement = vi.fn();
    const repository = { transaction: async (work: () => Promise<unknown>) => work(), lockCheckout: vi.fn().mockResolvedValue({ ...checkout, status: "READY_FOR_REVIEW", reviewVersion: 2, grandTotal: "15.00", commercialFingerprint: "fingerprint", changes: [{ type: "DELIVERY_FEE_CHANGED" }] }), findOperation: vi.fn().mockResolvedValue(null), createAcknowledgement };
    await expect(acknowledgeMarketplaceCheckoutReviewPersisted(repository as never, { reference: "checkout-1", owner, operationId: "ack-0001", requestHash: "ack", expectedVersion: 2, reviewVersion: 2, commercialFingerprint: "fingerprint", acknowledgedTotalReference: "15.00", termsVersion: "terms-1", privacyVersion: "privacy-1", refundPolicyReferences: ["refund-1"] })).resolves.toEqual({ acknowledged: true, reviewVersion: 2 });
    expect(createAcknowledgement).toHaveBeenCalledOnce();
    expect(createAcknowledgement).toHaveBeenCalledWith(expect.objectContaining({ settlementEvidenceVersions: ["settlement-evidence:v1:frozen"] }));
  });
});
