export type StoreDeliveryQuotePreview = { storeReference: string; fee: string; serviceLevel: string | null };

export function storeDeliveryQuotePreviewTotals(totals: { deliveryFeeTotal: string; grandTotal: string }, previews: readonly StoreDeliveryQuotePreview[]) {
  const cents = (value: string) => {
    if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) throw new Error("Checkout totals could not be verified.");
    return BigInt(value.replace(".", ""));
  };
  const money = (value: bigint) => `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
  const delivery = previews.reduce((sum, quote) => sum + cents(quote.fee), BigInt(0));
  const grand = cents(totals.grandTotal) - cents(totals.deliveryFeeTotal) + delivery;
  if (grand < BigInt(0)) throw new Error("Checkout totals could not be verified.");
  return { deliveryFeeTotal: money(delivery), grandTotal: money(grand) };
}

/** Presentation only. Reservation and payment still use the canonical review. */
export function storeDeliveryQuotePreviews(storeReferences: readonly string[], value: unknown): StoreDeliveryQuotePreview[] {
  if (!Array.isArray(value) || value.length !== storeReferences.length) throw new Error("Delivery quote evidence could not be verified. Refresh before continuing.");
  const seen = new Set<string>();
  return value.map(quote => {
    if (!quote || typeof quote !== "object" || typeof quote.storeReference !== "string" || !storeReferences.includes(quote.storeReference) || seen.has(quote.storeReference) || quote.currency !== "ZAR" || typeof quote.fee !== "string" || !/^(?:0|[1-9]\d*)\.\d{2}$/.test(quote.fee) || Number(quote.fee) > 1000000 || typeof quote.publicReference !== "string" || !quote.publicReference) throw new Error("Delivery quote evidence could not be verified. Refresh before continuing.");
    seen.add(quote.storeReference);
    return { storeReference: quote.storeReference, fee: quote.fee, serviceLevel: typeof quote.serviceLevel === "string" ? quote.serviceLevel : null };
  });
}
