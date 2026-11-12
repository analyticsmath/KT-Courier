/** After a parcel is booked, guide customers owing a digital payment straight to
 * the secure, owner-authorized payment review page. This performs no charge.
 * Fully cash-funded COD stays on order details; approved deposit-plus-COD needs payment before dispatch.
 */
export function parcelBookingDestination(input: Readonly<{
  business: boolean;
  paymentMethod: "DIGITAL_ONLY" | "FULL_COD" | "DEPOSIT_PLUS_COD";
  orderId: string;
  orderNumber?: string | null;
}>): string {
  const detail = `${input.business ? "/store" : "/account"}/orders/${encodeURIComponent(input.orderId)}`;
  if (input.paymentMethod === "FULL_COD") return detail;
  if (!input.orderNumber?.trim()) return detail;
  return `/orders/${encodeURIComponent(input.orderNumber)}/payment`;
}


/** Carry only the opaque server quote identifier across sign-in/signup.
 * No personal data, prices, or payment outcomes are trusted from this URL.
 */
export function parcelBookingStepHref(quoteId: string, business = false): string {
  return `/quote/book?reference=${encodeURIComponent(quoteId)}${business ? "&workspace=store" : ""}`;
}
