import { PaymentPolicyError } from "@/lib/payments/payment-policy.service";

/** Customer choice never grants financial authority: the resolved policy remains decisive. */
export function assertParcelPaymentChoice(deliveryType: string, requested: string | null | undefined): void {
  if (deliveryType === "PARCEL_DOCUMENT" && requested === "DEPOSIT_PLUS_COD") {
    throw new PaymentPolicyError("PAYMENT_METHOD_NOT_ALLOWED", "Parcel deliveries support full online payment or independently approved 100% cash on delivery.");
  }
}

export function assertSelectedPaymentMode(requested: string | null | undefined, authorized: string | null | undefined): void {
  if (requested && requested !== "DIGITAL_ONLY" && requested !== authorized) {
    throw new PaymentPolicyError("PAYMENT_METHOD_NOT_ALLOWED", "That cash payment method is not currently approved for this delivery. Please choose an available method.");
  }
}
