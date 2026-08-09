import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

export type MarketplaceDeliveryQuoteInput = Readonly<{
  checkoutReference: string; storeReference: string; pickupLocationReference: string | null;
  serviceAreaReference: string | null; fulfilmentMode: string; lineCount: number;
}>;
export type MarketplaceDeliveryQuoteResult = Readonly<{
  fee: string; currency: "ZAR"; publicReference: string; version: string; expiresAt: Date;
  serviceabilityReference: string; serviceLevel: string | null;
}>;
export interface MarketplaceDeliveryQuoteAdapter {
  quoteStoreGroup(input: MarketplaceDeliveryQuoteInput): Promise<MarketplaceDeliveryQuoteResult>;
}

export type Phase6MarketplaceQuoteEvidence = Readonly<{
  checkoutReference: string;
  storeReference: string;
  pickupLocationReference: string;
  serviceAreaReference: string;
  fulfilmentMode: string;
  /** Exact Phase 6 request assembled from persisted pickup/delivery evidence. */
  phase6Request: unknown;
}>;

export type Phase6MarketplaceQuoteAuthority = Readonly<{
  resolveEvidence(input: MarketplaceDeliveryQuoteInput): Promise<Phase6MarketplaceQuoteEvidence | null>;
  quote(evidence: Phase6MarketplaceQuoteEvidence): Promise<MarketplaceDeliveryQuoteResult | null>;
}>;

/**
 * Marketplace composition over the existing Phase 6 authority. The authority
 * owns routing, serviceability and pricing: this adapter only proves that the
 * returned quote is bound to the persisted checkout evidence.
 */
export class Phase6MarketplaceDeliveryQuoteAdapter implements MarketplaceDeliveryQuoteAdapter {
  constructor(private readonly authority: Phase6MarketplaceQuoteAuthority) {}

  async quoteStoreGroup(input: MarketplaceDeliveryQuoteInput): Promise<MarketplaceDeliveryQuoteResult> {
    if (!input.pickupLocationReference || !input.serviceAreaReference || input.lineCount < 1) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A trusted pickup location and delivery serviceability decision are required.");
    }
    const evidence = await this.authority.resolveEvidence(input);
    if (!evidence
      || evidence.checkoutReference !== input.checkoutReference
      || evidence.storeReference !== input.storeReference
      || evidence.pickupLocationReference !== input.pickupLocationReference
      || evidence.serviceAreaReference !== input.serviceAreaReference
      || evidence.fulfilmentMode !== input.fulfilmentMode) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Phase 6 quote input evidence is missing or belongs to another checkout group.");
    }
    const quote = await this.authority.quote(evidence);
    if (!quote || quote.currency !== "ZAR" || !quote.publicReference || !quote.version || !quote.serviceabilityReference || quote.expiresAt <= new Date()) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Phase 6 did not return an active ZAR quote with immutable evidence.");
    }
    if (quote.serviceabilityReference !== evidence.serviceAreaReference) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Phase 6 quote serviceability does not match the checkout destination evidence.");
    }
    return Object.freeze({ ...quote, fee: exactMoney(quote.fee) });
  }
}

/**
 * The adapter deliberately has no fee formula. Its dependency must be a Phase 6
 * pricing/serviceability authority and is responsible for returning immutable
 * evidence. This prevents client fees, synthetic zones, dispatch records, and
 * courier-order mutation from leaking into marketplace checkout.
 */
export function createMarketplaceDeliveryQuoteAdapter(dependencies: Readonly<{
  resolvePhase6Evidence(input: MarketplaceDeliveryQuoteInput): Promise<MarketplaceDeliveryQuoteResult | null>;
}>): MarketplaceDeliveryQuoteAdapter {
  return Object.freeze({
    async quoteStoreGroup(input: MarketplaceDeliveryQuoteInput) {
      if (!input.pickupLocationReference || !input.serviceAreaReference || input.lineCount < 1) {
        throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A trusted pickup location and service area are required for delivery quoting.");
      }
      const quote = await dependencies.resolvePhase6Evidence(input);
      if (!quote || quote.currency !== "ZAR" || !quote.publicReference || !quote.version || quote.expiresAt <= new Date() || !quote.serviceabilityReference) {
        throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Authoritative delivery quote evidence is unavailable.");
      }
      return Object.freeze({ ...quote, fee: exactMoney(quote.fee) });
    },
  });
}

function exactMoney(value: string): string {
  if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Authoritative delivery quote amount is invalid.");
  return value;
}
