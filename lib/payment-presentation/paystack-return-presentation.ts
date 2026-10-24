export type PaystackReturnPresentation = Readonly<{
  title: string;
  description: string;
  tone: "success" | "information" | "warning";
}>;

/** Browser query strings are not payment evidence. The canonical payment
 * status wins over cancelled/returned flags supplied in the callback URL. */
export function resolvePaystackReturnPresentation(
  canonicalStatus: string,
  cancelledInBrowser: boolean,
): PaystackReturnPresentation {
  if (canonicalStatus === "SUCCEEDED") {
    return {
      title: "Payment confirmed",
      description: "Your payment has been verified and recorded. You can now follow the delivery's operational progress.",
      tone: "success",
    };
  }
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(canonicalStatus)) {
    return {
      title: "Payment not completed",
      description: "No completed payment is recorded for this attempt. Review the payment details before trying again.",
      tone: "warning",
    };
  }
  if (cancelledInBrowser) {
    return {
      title: "Checkout not completed",
      description: "You returned from Paystack without completing checkout. An outstanding payment may still be processing, so check its status before trying again.",
      tone: "warning",
    };
  }
  return {
    title: "We are checking your payment",
    description: "You have returned from Paystack. We are waiting for verified payment confirmation.",
    tone: "information",
  };
}
