export type StoreDeliveryQuotePreview = { storeReference: string; fee: string; serviceLevel: string | null };

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
