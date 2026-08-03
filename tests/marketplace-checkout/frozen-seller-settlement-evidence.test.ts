import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { freezeMarketplaceStoreSettlementEvidence } from "@/lib/marketplace-checkout/frozen-seller-settlement-evidence.service";

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: "rule-id", publicReference: "commission-rule-1", ruleCode: "platform-10-percent", priority: 1,
  allocationType: "PLATFORM_COMMISSION_REVENUE" as const, beneficiaryType: "PLATFORM" as const,
  calculationMethod: "PERCENTAGE_BPS" as const, rateBasisPoints: 1000, fixedAmount: null,
  minimumAmount: null, maximumAmount: null, isRequired: true, ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  checkoutReference: "checkout-1", reviewVersion: 3, commercialFingerprint: "review-fingerprint",
  checkoutStoreGroupReference: "group-1", storeId: "store-id", storeReference: "store-public",
  deliveryFee: "7.00", authoritativeAt: "2026-07-19T00:00:00.000Z",
  sellerIdentity: { publicReference: "seller-identity-1", identityVersion: "seller-v2", legalName: "KT Foods (Pty) Ltd", tradingName: "KT Foods", registrationReference: "2026/123456/07", vatRegistrationStatus: "REGISTERED", vatNumber: "4123456789", countryCode: "ZA", termsReference: "terms-v4", invoiceClassification: "STORE_SELLER" },
  commissionPlan: { publicReference: "plan-1", versionNumber: 4, calculationVersion: "phase14-v2", basisType: "ORDER_SUBTOTAL" as const, subjectType: "MARKETPLACE_STORE_ORDER" as const, scopeKey: "STORE:store-id", rules: [rule()] },
  lines: [
    { lineReference: "line-b", storeReference: "store-public", offerReference: "offer-b", variantReference: "variant-b", quantity: 2, priceVersion: "price-b", publicationVersion: "publication-b", baseUnitPrice: "4.00", modifierUnitTotal: "0.50", lineTotal: "9.00", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: "1.17" },
    { lineReference: "line-a", storeReference: "store-public", offerReference: "offer-a", variantReference: "variant-a", quantity: 1, priceVersion: "price-a", publicationVersion: "publication-a", baseUnitPrice: "10.00", modifierUnitTotal: "1.50", lineTotal: "11.50", taxTreatment: "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: "1.50" },
  ],
  ...overrides,
});

function checkoutError(code: string) {
  return expect.objectContaining({ code }) as MarketplaceCheckoutError;
}

describe("frozen marketplace store settlement evidence", () => {
  it("freezes approved public seller authority without owner or private contact data", () => {
    const evidence = freezeMarketplaceStoreSettlementEvidence(input());
    expect(evidence.sellerIdentity).toEqual(expect.objectContaining({ sellerType: "STORE", storePublicReference: "store-public", legalName: "KT Foods (Pty) Ltd", identityVersion: "seller-v2" }));
    expect(evidence.sellerIdentity).not.toHaveProperty("ownerUserId");
    expect(evidence.sellerIdentity).not.toHaveProperty("bankDetails");
    expect(evidence.sellerIdentity).not.toHaveProperty("privateContact");
  });

  it("uses exact merchandise plus modifiers as seller basis and excludes delivery fees", () => {
    const evidence = freezeMarketplaceStoreSettlementEvidence(input());
    expect(evidence.sellerSettlementBasisAmount).toBe("20.50");
    expect(evidence.attributedCommissionAmount).toBe("2.05");
    expect(evidence.netStoreEarningAmount).toBe("18.45");
    expect(evidence.deliveryFeeExcludedAmount).toBe("7.00");
    expect(evidence.commission.beneficiaryAllocations).toEqual([expect.objectContaining({ beneficiaryType: "PLATFORM", beneficiaryReference: "PLATFORM", amount: "2.05" })]);
    expect(evidence.lineAllocations.reduce((total, line) => total + Number(line.sellerSettlementBasisAmount), 0)).toBe(20.5);
  });

  it("fails closed for missing legal seller identity or invalid VAT evidence", () => {
    expect(() => freezeMarketplaceStoreSettlementEvidence(input({ sellerIdentity: { ...input().sellerIdentity, legalName: "" } }))).toThrow(checkoutError("SELLER_IDENTITY_INCOMPLETE"));
    expect(() => freezeMarketplaceStoreSettlementEvidence(input({ sellerIdentity: { ...input().sellerIdentity, vatNumber: "invalid!" } }))).toThrow(checkoutError("SELLER_IDENTITY_VERSION_INVALID"));
    expect(() => freezeMarketplaceStoreSettlementEvidence(input({ sellerIdentity: { ...input().sellerIdentity, identityVersion: "" } }))).toThrow(checkoutError("SELLER_IDENTITY_VERSION_INVALID"));
  });

  it("fails closed for missing or wrong frozen commission authority", () => {
    expect(() => freezeMarketplaceStoreSettlementEvidence(input({ commissionPlan: { ...input().commissionPlan, publicReference: "" } }))).toThrow(checkoutError("COMMISSION_PLAN_MISSING"));
    expect(() => freezeMarketplaceStoreSettlementEvidence(input({ commissionPlan: { ...input().commissionPlan, scopeKey: "STORE:other" } }))).toThrow(checkoutError("COMMISSION_PLAN_VERSION_INVALID"));
  });

  it("freezes every configured beneficiary allocation in deterministic rule order", () => {
    const evidence = freezeMarketplaceStoreSettlementEvidence(input({ commissionPlan: {
      ...input().commissionPlan,
      rules: [rule({ rateBasisPoints: 500, priority: 1 }), rule({ id: "promoter-rule", publicReference: "promoter-rule-1", ruleCode: "promoter-fixed", priority: 2, allocationType: "BENEFICIARY_COMMISSION_PAYABLE", beneficiaryType: "PROMOTER", calculationMethod: "FIXED_AMOUNT", rateBasisPoints: null, fixedAmount: new Prisma.Decimal("1.00") })],
      beneficiaries: [{ beneficiaryType: "PROMOTER", ownerId: "promoter-owner", walletId: "promoter-wallet", commissionPayableAccountId: "promoter-account", attributionReference: "promoter-attribution", attributionVersion: "attribution-v2" }],
    } }));
    expect(evidence.commission.beneficiaryAllocations).toEqual([
      expect.objectContaining({ beneficiaryType: "PLATFORM", beneficiaryReference: "PLATFORM", amount: "1.03" }),
      expect.objectContaining({ beneficiaryType: "PROMOTER", beneficiaryReference: "promoter-attribution", beneficiaryVersion: "attribution-v2", beneficiaryOwnerId: "promoter-owner", beneficiaryWalletId: "promoter-wallet", commissionPayableAccountId: "promoter-account", amount: "1.00" }),
    ]);
  });

  it("assigns final-cent residuals by stable line reference ordering and retains old evidence", () => {
    const first = freezeMarketplaceStoreSettlementEvidence(input({ commissionPlan: { ...input().commissionPlan, rules: [rule({ calculationMethod: "FIXED_AMOUNT", rateBasisPoints: null, fixedAmount: new Prisma.Decimal("0.01") })] } }));
    const second = freezeMarketplaceStoreSettlementEvidence(input({ reviewVersion: 4, commercialFingerprint: "new-review-fingerprint", commissionPlan: { ...input().commissionPlan, rules: [rule({ calculationMethod: "FIXED_AMOUNT", rateBasisPoints: null, fixedAmount: new Prisma.Decimal("0.01") })] } }));
    expect(first.lineAllocations.map((line) => line.sourceLineReference)).toEqual(["line-a", "line-b"]);
    expect(first.lineAllocations.map((line) => line.attributedCommissionAmount)).toEqual(["0.00", "0.01"]);
    expect(first.lineAllocations.at(-1)?.finalCentRecipient).toBe(true);
    expect(first.sourceEvidenceFingerprint).not.toBe(second.sourceEvidenceFingerprint);
    expect(first.checkoutReviewVersion).toBe(3);
  });
});
