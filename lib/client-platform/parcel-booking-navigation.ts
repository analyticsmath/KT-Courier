/** After a parcel is booked, guide online-payment customers straight to
 * the secure, owner-authorized payment review page. This performs no charge.
 * COD stays on order details so the driver collects only if policy allows.
 */
export function parcelBookingDestination(input: Readonly<{
  business: boolean;
  paymentMethod: "DIGITAL_ONLY" | "FULL_COD";
  orderId: string;
  orderNumber?: string | null;
}>): string {
  const detail = `${input.business ? "/store" : "/account"}/orders/${encodeURIComponent(input.orderId)}`;
  if (input.paymentMethod !== "DIGITAL_ONLY") return detail;
  if (!input.orderNumber?.trim()) return detail;
  return `/orders/${encodeURIComponent(input.orderNumber)}/payment`;
}
