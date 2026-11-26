import { PaymentPolicyError } from "@/lib/payments/payment-policy.service";

/** Customer choice never grants financial authority: the resolved policy remains decisive. */
export function assertParcelPaymentChoice(deliveryType: string, requested: string | null | undefined): void {
  if (deliveryType === "PARCEL_DOCUMENT" && requested &&
      !["DIGITAL_ONLY", "DEPOSIT_PLUS_COD"].includes(requested)) {
    throw new PaymentPolicyError(
      "PAYMENT_METHOD_NOT_ALLOWED",
      requested === "FULL_COD"
        ? "100% cash on delivery is discontinued. Select online payment or the approved 50% online deposit + 50% driver cash option."
        : "Select an authorized parcel payment method.",
    );
  }
  // A requested deposit never grants permission. The effective independently
  // approved store/service/area policy is rechecked in the booking transaction.
}

export function assertSelectedPaymentMode(requested: string | null | undefined, authorized: string | null | undefined): void {
  if (requested === "FULL_COD") {
    throw new PaymentPolicyError(
      "PAYMENT_METHOD_NOT_ALLOWED",
      "100% cash on delivery is discontinued for new bookings. Select online payment or the approved 50% online deposit + 50% driver cash method.",
    );
  }
  if (requested && requested !== "DIGITAL_ONLY" && requested !== authorized) {
    throw new PaymentPolicyError("PAYMENT_METHOD_NOT_ALLOWED", "That cash payment method is not currently approved for this delivery. Please choose an available method.");
  }
}
