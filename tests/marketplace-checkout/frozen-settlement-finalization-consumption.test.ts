import { describe, expect, it } from "vitest";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { buildPaidMarketplaceCheckoutFromFrozenEvidence } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";

const allocation = (id: string, amount: string, commission: string, earning: string, ordering: number, finalCentRecipient: boolean) => ({
  checkoutLineSnapshotId: id, stableOrderingKey: `${ordering}:${id}`, merchandiseBasisAmount: amount, modifierBasisAmount: "0.00", sellerSettlementBasisAmount: amount,
  attributedCommissionAmount: commission, netStoreEarningAmount: earning, allocationVersion: "phase20-frozen-v1", roundingSequence: ordering, finalCentRecipient,
});

const evidence = (fingerprint = "accepted-fingerprint") => ({
  id: "evidence-id", publicReference: "evidence-public", checkoutId: "checkout-id", checkoutStoreGroupId: "group-id", reviewVersion: 4,
  commercialFingerprint: fingerprint, evidenceVersion: "phase20-frozen-v1", sourceEvidenceFingerprint: "source-evidence-fingerprint",
  sellerIdentityEvidence: { sellerType: "STORE", storePublicReference: "frozen-store", legalName: "Frozen Seller (Pty) Ltd", identityVersion: "seller-v4" },
  commissionPlanReference: "frozen-plan", commissionPlanVersion: 7, commissionEvidence: { planReference: "frozen-plan", planVersion: 7 },
  sellerSettlementBasisAmount: "15.00", attributedCommissionAmount: "1.50", netStoreEarningAmount: "13.50", deliveryFeeExcludedAmount: "6.00",
  taxEvidence: [{ lineReference: "snapshot-a", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: "0.00" }], policyReferences: { termsReference: "terms-v4" },
  allocations: [allocation("snapshot-a", "10.00", "1.00", "9.00", 0, false), allocation("snapshot-b", "5.00", "0.50", "4.50", 1, true)],
});

const row = (fingerprint = "accepted-fingerprint") => ({
  id: "checkout-id", publicReference: "checkout-public", cartId: "cart-id", status: "PAYMENT_CONFIRMED", currency: "ZAR", grandTotal: "21.00", acceptedFingerprint: fingerprint, customerUserId: null,
  storeGroups: [{ id: "group-id", storeId: "store-id", merchandiseSubtotal: "15.00", modifierSubtotal: "0.00", deliveryFee: "6.00", groupTotal: "21.00", sellerIdentityEvidence: { legalName: "Mutable seller must not be used" }, lines: [
    { id: "snapshot-a", productReference: "product-a", variantReference: "variant-a", offerReference: "offer-a", productTitle: "A", variantTitle: "A", quantity: 1, baseUnitPrice: "10.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "10.00", lineTotal: "10.00", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: "0.00", modifiers: [] },
    { id: "snapshot-b", productReference: "product-b", variantReference: "variant-b", offerReference: "offer-b", productTitle: "B", variantTitle: "B", quantity: 1, baseUnitPrice: "5.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "5.00", lineTotal: "5.00", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: "0.00", modifiers: [] },
  ] }],
});

describe("frozen settlement finalizer consumption", () => {
  it("uses acknowledged frozen seller, allocation and source evidence without recalculation", () => {
    const frozen = evidence();
    const acknowledgement = { commercialFingerprint: "accepted-fingerprint", settlementEvidenceVersions: ["evidence-public:phase20-frozen-v1:source-evidence-fingerprint"] };
    const paid = buildPaidMarketplaceCheckoutFromFrozenEvidence(row(), [frozen], acknowledgement);
    expect(paid.storeGroups[0]).toMatchObject({ storeReference: "frozen-store", sellerIdentityEvidence: { legalName: "Frozen Seller (Pty) Ltd" }, settlement: { sellerBasis: "15.00", commissionAmount: "1.50", storeEarningAmount: "13.50", deliveryFeeResidual: "6.00", sourceSettlementEvidenceId: "evidence-id" } });
    expect(paid.storeGroups[0]?.lines.flatMap((line) => line.allocations.map((item) => item.amount))).toEqual(["10.00", "1.00", "9.00", "5.00", "0.50", "4.50"]);
  });

  it("fails closed before order creation when acknowledged evidence does not match", () => {
    const frozen = evidence("other-fingerprint");
    const acknowledgement = { commercialFingerprint: "accepted-fingerprint", settlementEvidenceVersions: ["evidence-public:phase20-frozen-v1:source-evidence-fingerprint"] };
    expect(() => buildPaidMarketplaceCheckoutFromFrozenEvidence(row(), [frozen], acknowledgement)).toThrow(MarketplaceCheckoutError);
    try { buildPaidMarketplaceCheckoutFromFrozenEvidence(row(), [frozen], acknowledgement); } catch (error) { expect(error).toMatchObject({ code: "SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE" }); }
  });
});
