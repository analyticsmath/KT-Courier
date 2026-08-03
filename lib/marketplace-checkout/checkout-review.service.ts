import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertCheckoutTotals, canonicalMarketplaceFingerprint, centsToZar, parseZarToCents } from "@/lib/marketplace-checkout/policy";
import type { MarketplaceDeliveryQuoteAdapter } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";
import { Decimal } from "@prisma/client/runtime/library";

// Phase 23: Promotion evaluation
export interface PromotionEvaluationAdapter {
  evaluate(input: {
    checkoutId: string;
    customerUserId?: string;
    guestEvidenceReference?: string;
    storeGroups: { storeReference: string; lines: { lineReference: string; merchandiseSubtotal: Decimal; modifierSubtotal: Decimal; }[] }[];
    deliveryQuotes: { storeReference: string; feeAmount: Decimal; }[];
    appliedCouponCode?: string;
    subscriptionBenefitEvidence?: unknown;
    now: Date;
  }): Promise<{ totalDiscount: Decimal; totalPlatformFunding: Decimal; totalStoreFunding: Decimal; allocations: unknown[]; evidence: unknown; } | null>;
}

export type ReviewLine = Readonly<{ lineReference: string; storeReference: string; offerReference: string; variantReference: string; quantity: number; priceVersion: string; publicationVersion: string; baseUnitPrice: string; modifierUnitTotal: string; lineTotal: string; productReference?: string; productTitle?: string; variantTitle?: string; sellingUnit?: string; taxTreatment?: string; includedTaxAmount?: string | null; inventoryItemId?: string | null; inventoryLocationId?: string | null; modifiers?: readonly { groupReference: string; groupName: string; optionReference: string; optionName: string; quantity: number; priceDelta: string; totalContribution: string; sourceVersion: string }[] }>;
export type ReviewGroup = Readonly<{ storeReference: string; pickupLocationReference: string | null; fulfilmentMode: string; lines: readonly ReviewLine[] }>;
export type RevalidatedLine = Readonly<{ lineReference: string; available: boolean; quantity: number; priceVersion: string; publicationVersion: string; baseUnitPrice: string; modifierUnitTotal: string; lineTotal: string; modifierValid: boolean }>;
export type CheckoutReviewChange = Readonly<{ type: "PRICE_INCREASE" | "PRICE_DECREASE" | "QUANTITY_REDUCED" | "OUT_OF_STOCK" | "OFFER_WITHDRAWN" | "STORE_UNAVAILABLE" | "MODIFIER_CHANGED" | "DELIVERY_FEE_CHANGED" | "DELIVERY_OPTION_CHANGED" | "NOT_SERVICEABLE"; lineReference?: string; details: Readonly<Record<string, string>> }>;
export type MarketplaceCheckoutReviewResult = Readonly<{ status: "READY_FOR_REVIEW" | "CHANGES_REQUIRED"; reviewVersion: number; commercialFingerprint: string; merchandiseSubtotal: string; modifierSubtotal: string; deliveryFeeTotal: string; promotionDiscount: string; grandTotal: string; promotionEvidence?: unknown; changes: readonly CheckoutReviewChange[]; quotes: readonly { storeReference: string; quoteReference: string; quoteVersion: string; quoteExpiresAt: Date; deliveryFee: string; serviceabilityReference: string }[]; revalidatedGroups: readonly { storeReference: string; fulfilmentMode: string; lines: readonly ReviewLine[] }[] }>;

function add(left: string, right: string): string { let carry = 0; let out = ""; let i = left.length - 1; let j = right.length - 1; while (i >= 0 || j >= 0 || carry) { const n = (i >= 0 ? Number(left[i--]) : 0) + (j >= 0 ? Number(right[j--]) : 0) + carry; out = `${n % 10}${out}`; carry = Math.floor(n / 10); } return out.replace(/^0+(?=\d)/, ""); }
function sum(values: readonly string[]): string { return centsToZar(values.reduce((total, value) => add(total, parseZarToCents(value)), "0")); }
function multiplied(unit: string, quantity: number): string { let total = "0"; const cents = parseZarToCents(unit); for (let index = 0; index < quantity; index += 1) total = add(total, cents); return centsToZar(total); }

export async function revalidateMarketplaceCheckout(input: Readonly<{ checkoutId: string; checkoutReference: string; customerUserId?: string; guestEvidenceReference?: string; appliedCouponCode?: string; serviceAreaReference: string | null; reviewVersion: number; groups: readonly ReviewGroup[]; resolveLine(line: ReviewLine): Promise<RevalidatedLine>; quoteAdapter: MarketplaceDeliveryQuoteAdapter; promotionAdapter?: PromotionEvaluationAdapter; previousDeliveryFees?: Readonly<Record<string, string>>; commissionPolicyVersion: string }>): Promise<MarketplaceCheckoutReviewResult> {
  const changes: CheckoutReviewChange[] = []; const effectiveGroups: { storeReference: string; lines: ReviewLine[]; deliveryFee: string }[] = []; const quotes: MarketplaceCheckoutReviewResult["quotes"] = [];
  for (const group of input.groups) {
    const lines: ReviewLine[] = [];
    for (const line of group.lines) {
      const resolved = await input.resolveLine(line);
      if (!resolved.available) { changes.push({ type: "OUT_OF_STOCK", lineReference: line.lineReference, details: {} }); continue; }
      if (resolved.quantity < line.quantity) changes.push({ type: "QUANTITY_REDUCED", lineReference: line.lineReference, details: { from: String(line.quantity), to: String(resolved.quantity) } });
      if (!resolved.modifierValid) changes.push({ type: "MODIFIER_CHANGED", lineReference: line.lineReference, details: {} });
      if (parseZarToCents(resolved.baseUnitPrice) > parseZarToCents(line.baseUnitPrice)) changes.push({ type: "PRICE_INCREASE", lineReference: line.lineReference, details: { from: line.baseUnitPrice, to: resolved.baseUnitPrice } });
      if (parseZarToCents(resolved.baseUnitPrice) < parseZarToCents(line.baseUnitPrice)) changes.push({ type: "PRICE_DECREASE", lineReference: line.lineReference, details: { from: line.baseUnitPrice, to: resolved.baseUnitPrice } });
      if (resolved.priceVersion !== line.priceVersion) changes.push({ type: "PRICE_DECREASE", lineReference: line.lineReference, details: { source: "PRICE_VERSION_CHANGED" } });
      lines.push({ ...line, quantity: resolved.quantity, priceVersion: resolved.priceVersion, publicationVersion: resolved.publicationVersion, baseUnitPrice: resolved.baseUnitPrice, modifierUnitTotal: resolved.modifierUnitTotal, lineTotal: resolved.lineTotal });
    }
    if (!lines.length) { changes.push({ type: "STORE_UNAVAILABLE", details: { storeReference: group.storeReference } }); continue; }
    try {
      const quote = await input.quoteAdapter.quoteStoreGroup({ checkoutReference: input.checkoutReference, storeReference: group.storeReference, pickupLocationReference: group.pickupLocationReference, serviceAreaReference: input.serviceAreaReference, fulfilmentMode: group.fulfilmentMode, lineCount: lines.length });
      const previous = input.previousDeliveryFees?.[group.storeReference]; if (previous && previous !== quote.fee) changes.push({ type: "DELIVERY_FEE_CHANGED", details: { storeReference: group.storeReference, from: previous, to: quote.fee } });
      effectiveGroups.push({ storeReference: group.storeReference, lines, deliveryFee: quote.fee }); (quotes as any).push({ storeReference: group.storeReference, quoteReference: quote.publicReference, quoteVersion: quote.version, quoteExpiresAt: quote.expiresAt, deliveryFee: quote.fee, serviceabilityReference: quote.serviceabilityReference });
    } catch (error) { changes.push({ type: "NOT_SERVICEABLE", details: { storeReference: group.storeReference, reason: error instanceof Error ? error.message : "QUOTE_UNAVAILABLE" } }); }
  }
  const merchandiseSubtotal = sum(effectiveGroups.flatMap((group) => group.lines.map((line) => multiplied(line.baseUnitPrice, line.quantity))));
  const modifierSubtotal = sum(effectiveGroups.flatMap((group) => group.lines.map((line) => multiplied(line.modifierUnitTotal, line.quantity))));
  const deliveryFeeTotal = sum(effectiveGroups.map((group) => group.deliveryFee));
  
  // Phase 23: Promotion evaluation integration
  let promotionDiscount = "0.00";
  let promotionEvidence: unknown = null;
  
  if (input.promotionAdapter) {
    const evalResult = await input.promotionAdapter.evaluate({
      checkoutId: input.checkoutId,
      customerUserId: input.customerUserId,
      guestEvidenceReference: input.guestEvidenceReference,
      storeGroups: effectiveGroups.map((group) => ({
        storeReference: group.storeReference,
        lines: group.lines.map((line) => ({
          lineReference: line.lineReference,
          merchandiseSubtotal: new Decimal(multiplied(line.baseUnitPrice, line.quantity)),
          modifierSubtotal: new Decimal(multiplied(line.modifierUnitTotal, line.quantity)),
        })),
      })),
      deliveryQuotes: quotes.map((quote) => ({
        storeReference: quote.storeReference,
        feeAmount: new Decimal(quote.deliveryFee),
      })),
      appliedCouponCode: input.appliedCouponCode,
      now: new Date(),
    });
    
    if (evalResult) {
      promotionDiscount = evalResult.totalDiscount.toFixed(2);
      promotionEvidence = {
        totalStoreFunding: evalResult.totalStoreFunding.toFixed(2),
        allocations: evalResult.allocations,
        evidence: evalResult.evidence,
      };
    }
  }

  const preDiscountCents = Number(parseZarToCents(merchandiseSubtotal)) + Number(parseZarToCents(modifierSubtotal)) + Number(parseZarToCents(deliveryFeeTotal));
  const grandTotal = centsToZar(String(Math.max(0, preDiscountCents - Number(parseZarToCents(promotionDiscount)))));

  assertCheckoutTotals({ merchandiseSubtotal, modifierSubtotal, deliveryFeeTotal, promotionDiscount, grandTotal });
  const blocking = changes.some((change) => ["OUT_OF_STOCK", "OFFER_WITHDRAWN", "STORE_UNAVAILABLE", "MODIFIER_CHANGED", "NOT_SERVICEABLE", "QUANTITY_REDUCED", "PRICE_INCREASE"].includes(change.type));
  const commercialFingerprint = canonicalMarketplaceFingerprint({ checkoutReference: input.checkoutReference, reviewVersion: input.reviewVersion, groups: effectiveGroups, quotes, commissionPolicyVersion: input.commissionPolicyVersion, currency: "ZAR" });
  return Object.freeze({ status: blocking ? "CHANGES_REQUIRED" : "READY_FOR_REVIEW", reviewVersion: input.reviewVersion, commercialFingerprint, merchandiseSubtotal, modifierSubtotal, deliveryFeeTotal, promotionDiscount, grandTotal, promotionEvidence, changes: Object.freeze(changes), quotes: Object.freeze(quotes), revalidatedGroups: Object.freeze(effectiveGroups.map((group) => Object.freeze({ storeReference: group.storeReference, fulfilmentMode: input.groups.find((candidate) => candidate.storeReference === group.storeReference)?.fulfilmentMode ?? "DELIVERY", lines: Object.freeze(group.lines) }))) });
}

export function acknowledgeMarketplaceCheckoutReview(input: Readonly<{ currentReviewVersion: number; reviewVersion: number; currentFingerprint: string; commercialFingerprint: string; currentGrandTotal: string; grandTotal: string; termsVersion: string; privacyVersion: string; refundPolicyReferences: readonly string[]; settlementEvidenceVersions?: readonly string[] }>): Readonly<{ acknowledged: true }> {
  if (input.currentReviewVersion !== input.reviewVersion || input.currentFingerprint !== input.commercialFingerprint || input.currentGrandTotal !== input.grandTotal || !input.termsVersion || !input.privacyVersion || !input.refundPolicyReferences.length || !input.settlementEvidenceVersions?.length) throw new MarketplaceCheckoutError("CHECKOUT_CHANGES_UNACKNOWLEDGED", "Checkout review is stale or incomplete.");
  return Object.freeze({ acknowledged: true });
}
