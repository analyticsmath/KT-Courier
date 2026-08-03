import { describe, expect, it } from "vitest";
import { Phase6MarketplaceDeliveryQuoteAdapter } from "@/lib/marketplace-checkout/marketplace-delivery-quote.service";

const input = { checkoutReference: "checkout-1", storeReference: "store-1", pickupLocationReference: "pickup-1", serviceAreaReference: "area-1", fulfilmentMode: "COURIER_DELIVERY", lineCount: 1 } as const;
const evidence = { checkoutReference: input.checkoutReference, storeReference: input.storeReference, pickupLocationReference: input.pickupLocationReference, serviceAreaReference: input.serviceAreaReference, fulfilmentMode: input.fulfilmentMode, phase6Request: {} };
const quote = { fee: "14.00", currency: "ZAR" as const, publicReference: "quote-1", version: "rule-7", expiresAt: new Date(Date.now() + 60_000), serviceabilityReference: "area-1", serviceLevel: "SAME_DAY" };

describe("Phase 6 marketplace quote composition", () => {
  it("returns only exact active Phase 6 quote evidence", async () => {
    const adapter = new Phase6MarketplaceDeliveryQuoteAdapter({ resolveEvidence: async () => evidence, quote: async () => quote });
    await expect(adapter.quoteStoreGroup(input)).resolves.toMatchObject({ fee: "14.00", publicReference: "quote-1" });
  });
  it("rejects wrong store/destination, stale quote, wrong currency and missing pickup", async () => {
    const invalidAuthorities = [
      { resolveEvidence: async () => ({ ...evidence, storeReference: "other" }), quote: async () => quote },
      { resolveEvidence: async () => evidence, quote: async () => ({ ...quote, expiresAt: new Date(Date.now() - 1) }) },
      { resolveEvidence: async () => evidence, quote: async () => ({ ...quote, currency: "USD" }) },
    ];
    for (const authority of invalidAuthorities) await expect(new Phase6MarketplaceDeliveryQuoteAdapter(authority as never).quoteStoreGroup(input)).rejects.toThrow();
    await expect(new Phase6MarketplaceDeliveryQuoteAdapter({ resolveEvidence: async () => evidence, quote: async () => quote }).quoteStoreGroup({ ...input, pickupLocationReference: null })).rejects.toThrow();
  });
});
