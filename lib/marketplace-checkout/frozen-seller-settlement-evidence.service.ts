import { createHash } from "node:crypto";
import { calculateCommission, type CommissionBeneficiarySnapshot, type CommissionCalculationRule } from "@/lib/commissions/commission-calculator";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import type { ReviewLine } from "@/lib/marketplace-checkout/checkout-review.service";

const cents = (value: string): bigint => {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new MarketplaceCheckoutError("SETTLEMENT_BASIS_INVALID", "Settlement evidence requires exact ZAR decimal values.");
  return BigInt(match[1]) * BigInt(100) + BigInt(match[2]);
};
const zar = (value: bigint) => `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
const multiplied = (amount: string, quantity: number) => zar(cents(amount) * BigInt(quantity));
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export type ReviewedSellerIdentity = Readonly<{
  publicReference: string;
  identityVersion: string;
  legalName: string;
  tradingName: string | null;
  registrationReference: string | null;
  vatRegistrationStatus: string;
  vatNumber: string | null;
  countryCode: string;
  termsReference: string | null;
  invoiceClassification: string | null;
}>;

export type ReviewedCommissionPlan = Readonly<{
  publicReference: string;
  versionNumber: number;
  calculationVersion: string;
  basisType: "ORDER_SUBTOTAL" | "ORDER_TOTAL";
  subjectType: "MARKETPLACE_STORE_ORDER";
  scopeKey: string;
  rules: readonly CommissionCalculationRule[];
  beneficiaries?: readonly CommissionBeneficiarySnapshot[];
}>;

export type FrozenMarketplaceSettlementLine = Readonly<{
  sourceLineReference: string;
  stableOrderingKey: string;
  merchandiseBasisAmount: string;
  modifierBasisAmount: string;
  sellerSettlementBasisAmount: string;
  attributedCommissionAmount: string;
  netStoreEarningAmount: string;
  taxEvidence: Readonly<{ taxTreatment: string; includedTaxAmount: string | null }>;
  allocationVersion: "phase20-frozen-v1";
  roundingSequence: number;
  finalCentRecipient: boolean;
}>;

export type FrozenMarketplaceStoreSettlementEvidence = Readonly<{
  checkoutReference: string;
  checkoutReviewVersion: number;
  commercialFingerprint: string;
  checkoutStoreGroupReference: string;
  storeReference: string;
  sellerIdentity: Readonly<{ sellerType: "STORE"; storePublicReference: string; legalName: string; tradingName: string | null; registrationReference: string | null; vatRegistrationStatus: string; vatNumber: string | null; countryCode: "ZA"; identityVersion: string; identityReference: string }>;
  paymentCurrency: "ZAR";
  sellerSettlementBasisAmount: string;
  attributedCommissionAmount: string;
  netStoreEarningAmount: string;
  deliveryFeeExcludedAmount: string;
  commission: Readonly<{ planReference: string; planVersion: number; calculationVersion: string; subjectType: "MARKETPLACE_STORE_ORDER"; subjectReference: string; allocationReferences: readonly string[]; beneficiaryAllocations: readonly Readonly<{ ruleReference: string; allocationType: string; beneficiaryType: string; beneficiaryReference: string; beneficiaryVersion: string | null; beneficiaryOwnerId: string | null; beneficiaryWalletId: string | null; commissionPayableAccountId: string | null; amount: string }>[] }>;
  lineAllocations: readonly FrozenMarketplaceSettlementLine[];
  taxEvidence: readonly Readonly<{ lineReference: string; taxTreatment: string; includedTaxAmount: string | null }>[];
  policyReferences: Readonly<{ termsReference: string | null; invoiceClassification: string | null }>;
  frozenPromotionEvidence: unknown;
  evidenceVersion: "phase20-frozen-v1";
  sourceEvidenceFingerprint: string;
}>;

function assertSellerIdentity(identity: ReviewedSellerIdentity): void {
  if (!identity.publicReference || identity.legalName.trim().length < 2 || identity.countryCode !== "ZA" || !identity.vatRegistrationStatus.trim()) throw new MarketplaceCheckoutError("SELLER_IDENTITY_INCOMPLETE", "The reviewed store lacks complete approved seller identity evidence.");
  if (!identity.identityVersion.trim()) throw new MarketplaceCheckoutError("SELLER_IDENTITY_VERSION_INVALID", "The reviewed seller identity version is invalid.");
  if (identity.vatRegistrationStatus === "REGISTERED" && !identity.vatNumber?.trim()) throw new MarketplaceCheckoutError("SELLER_IDENTITY_INCOMPLETE", "The reviewed seller VAT evidence is incomplete.");
  if (identity.vatNumber && !/^[A-Za-z0-9 -]{6,32}$/.test(identity.vatNumber)) throw new MarketplaceCheckoutError("SELLER_IDENTITY_VERSION_INVALID", "The reviewed seller VAT evidence is invalid.");
}

function assertCommissionPlan(plan: ReviewedCommissionPlan, storeId: string): void {
  if (!plan.publicReference) throw new MarketplaceCheckoutError("COMMISSION_PLAN_MISSING", "No approved commission plan applies to this store.");
  if (plan.subjectType !== "MARKETPLACE_STORE_ORDER" || plan.scopeKey !== `STORE:${storeId}` || !Number.isInteger(plan.versionNumber) || plan.versionNumber < 1 || !plan.calculationVersion) throw new MarketplaceCheckoutError("COMMISSION_PLAN_VERSION_INVALID", "The reviewed commission plan does not match this store settlement subject.");
  if (!plan.rules.length) throw new MarketplaceCheckoutError("COMMISSION_PLAN_NOT_APPROVED", "The approved commission plan has no applicable rules.");
}

function distribute(total: string, weights: readonly string[]): readonly string[] {
  const totalCents = cents(total); const weightCents = weights.map(cents); const denominator = weightCents.reduce((sum, value) => sum + value, BigInt(0));
  if (denominator <= BigInt(0)) throw new MarketplaceCheckoutError("SETTLEMENT_BASIS_INVALID", "Seller settlement basis must be positive.");
  let allocated = BigInt(0);
  return Object.freeze(weightCents.map((weight, index) => {
    const amount = index === weightCents.length - 1 ? totalCents - allocated : totalCents * weight / denominator;
    allocated += amount; return zar(amount);
  }));
}

/** Pure Phase 20 review authority. It reuses Phase 14 calculation rules but never accrues a journal. */
export function freezeMarketplaceStoreSettlementEvidence(input: Readonly<{
  checkoutReference: string;
  reviewVersion: number;
  commercialFingerprint: string;
  checkoutStoreGroupReference: string;
  storeId: string;
  storeReference: string;
  deliveryFee: string;
  sellerIdentity: ReviewedSellerIdentity;
  commissionPlan: ReviewedCommissionPlan;
  lines: readonly ReviewLine[];
  authoritativeAt: string;
  storeFundedPromotionAmount?: string;
  frozenPromotionEvidence?: unknown;
}>): FrozenMarketplaceStoreSettlementEvidence {
  assertSellerIdentity(input.sellerIdentity); assertCommissionPlan(input.commissionPlan, input.storeId);
  if (!input.lines.length || cents(input.deliveryFee) < BigInt(0)) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "A reviewed store group requires complete line and delivery evidence.");
  const ordered = [...input.lines].sort((left, right) => left.lineReference.localeCompare(right.lineReference));
  const storeFundedPromotionAmount = input.storeFundedPromotionAmount ?? "0.00";
  const basesPreDiscount = ordered.map((line) => zar(cents(multiplied(line.baseUnitPrice, line.quantity)) + cents(multiplied(line.modifierUnitTotal, line.quantity))));
  const lineStoreFundedDiscount = distribute(storeFundedPromotionAmount, basesPreDiscount);
  const bases = basesPreDiscount.map((basis, idx) => zar(cents(basis) - cents(lineStoreFundedDiscount[idx]!)));
  const sellerBasis = zar(bases.reduce((sum, value) => sum + cents(value), BigInt(0)));
  const subjectReference = `${input.checkoutReference}:${input.checkoutStoreGroupReference}:review:${input.reviewVersion}`;
  const calculation = calculateCommission({
    basis: { subjectType: "MARKETPLACE_STORE_ORDER", subjectId: input.checkoutStoreGroupReference, subjectPublicReference: subjectReference, pricingReference: input.commercialFingerprint, pricingVersion: String(input.reviewVersion), subtotal: sellerBasis, tax: "0.00", total: sellerBasis, currency: "ZAR", authoritativeAt: input.authoritativeAt },
    basisType: input.commissionPlan.basisType, calculationVersion: input.commissionPlan.calculationVersion, rules: input.commissionPlan.rules, beneficiaries: input.commissionPlan.beneficiaries,
  });
  const lineCommission = distribute(calculation.totalAmount, bases);
  const lineAllocations = Object.freeze(ordered.map((line, index) => {
    const merchandise = multiplied(line.baseUnitPrice, line.quantity); const modifiers = multiplied(line.modifierUnitTotal, line.quantity); const basis = bases[index]!; const commission = lineCommission[index]!; const earning = zar(cents(basis) - cents(commission));
    return Object.freeze({ sourceLineReference: line.lineReference, stableOrderingKey: `${index.toString().padStart(6, "0")}:${line.lineReference}`, merchandiseBasisAmount: merchandise, modifierBasisAmount: modifiers, sellerSettlementBasisAmount: basis, attributedCommissionAmount: commission, netStoreEarningAmount: earning, taxEvidence: Object.freeze({ taxTreatment: line.taxTreatment ?? "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: line.includedTaxAmount ?? null }), allocationVersion: "phase20-frozen-v1" as const, roundingSequence: index, finalCentRecipient: index === ordered.length - 1 });
  }));
  const commission = zar(lineAllocations.reduce((sum, line) => sum + cents(line.attributedCommissionAmount), BigInt(0)));
  const earning = zar(lineAllocations.reduce((sum, line) => sum + cents(line.netStoreEarningAmount), BigInt(0)));
  if (cents(sellerBasis) - cents(commission) !== cents(earning) || cents(commission) !== cents(calculation.totalAmount)) throw new MarketplaceCheckoutError("LINE_ALLOCATION_ROUNDING_MISMATCH", "Deterministic seller allocation rounding did not reconcile.");
  const merchandiseAndModifiers = zar(ordered.reduce((sum, line) => sum + cents(multiplied(line.baseUnitPrice, line.quantity)) + cents(multiplied(line.modifierUnitTotal, line.quantity)), BigInt(0)));
  if (sellerBasis !== zar(cents(merchandiseAndModifiers) - cents(storeFundedPromotionAmount))) throw new MarketplaceCheckoutError("DELIVERY_FEE_INCLUDED_IN_SELLER_BASIS", "Delivery fees must not form seller settlement basis.");
  const commissionEvidence = Object.freeze({ planReference: input.commissionPlan.publicReference, planVersion: input.commissionPlan.versionNumber, calculationVersion: input.commissionPlan.calculationVersion, subjectType: "MARKETPLACE_STORE_ORDER" as const, subjectReference, allocationReferences: Object.freeze(calculation.components.map((component) => component.rulePublicReference)), beneficiaryAllocations: Object.freeze(calculation.components.map((component) => Object.freeze({ ruleReference: component.rulePublicReference, allocationType: component.allocationType, beneficiaryType: component.beneficiaryType, beneficiaryReference: component.beneficiary?.attributionReference ?? "PLATFORM", beneficiaryVersion: component.beneficiary?.attributionVersion ?? null, beneficiaryOwnerId: component.beneficiary?.ownerId ?? null, beneficiaryWalletId: component.beneficiary?.walletId ?? null, commissionPayableAccountId: component.beneficiary?.commissionPayableAccountId ?? null, amount: component.amount }))) });
  const evidence = { checkoutReference: input.checkoutReference, checkoutReviewVersion: input.reviewVersion, commercialFingerprint: input.commercialFingerprint, checkoutStoreGroupReference: input.checkoutStoreGroupReference, storeReference: input.storeReference, sellerIdentity: Object.freeze({ sellerType: "STORE" as const, storePublicReference: input.storeReference, legalName: input.sellerIdentity.legalName, tradingName: input.sellerIdentity.tradingName, registrationReference: input.sellerIdentity.registrationReference, vatRegistrationStatus: input.sellerIdentity.vatRegistrationStatus, vatNumber: input.sellerIdentity.vatNumber, countryCode: "ZA" as const, identityVersion: input.sellerIdentity.identityVersion, identityReference: input.sellerIdentity.publicReference }), paymentCurrency: "ZAR" as const, sellerSettlementBasisAmount: sellerBasis, attributedCommissionAmount: commission, netStoreEarningAmount: earning, deliveryFeeExcludedAmount: input.deliveryFee, commission: commissionEvidence, lineAllocations, taxEvidence: Object.freeze(lineAllocations.map((line) => Object.freeze({ lineReference: line.sourceLineReference, ...line.taxEvidence }))), policyReferences: Object.freeze({ termsReference: input.sellerIdentity.termsReference, invoiceClassification: input.sellerIdentity.invoiceClassification }), frozenPromotionEvidence: input.frozenPromotionEvidence ?? null, evidenceVersion: "phase20-frozen-v1" as const };
  return Object.freeze({ ...evidence, sourceEvidenceFingerprint: fingerprint(evidence) });
}
