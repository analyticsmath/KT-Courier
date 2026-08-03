export type CustomerPaymentPresentation = Readonly<{
  label: string;
  tone: "success" | "warning" | "danger" | "information" | "neutral";
}>;

const PAYMENT_STATUSES: Readonly<Record<string, CustomerPaymentPresentation>> = {
  CREATED: { label: "Not prepared", tone: "neutral" },
  PROVIDER_PENDING: { label: "Awaiting provider confirmation", tone: "warning" },
  PROCESSING: { label: "Confirmation in progress", tone: "information" },
  SUCCEEDED: { label: "Confirmed", tone: "success" },
  FAILED: { label: "Not completed", tone: "danger" },
  CANCELLED: { label: "Not completed", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  UNKNOWN: { label: "Outcome requires verification", tone: "neutral" },
};

/** Presentation-only map: unknown canonical values never imply a payment outcome. */
export function getCustomerPaymentStatusPresentation(status: string | null | undefined): CustomerPaymentPresentation {
  return status ? PAYMENT_STATUSES[status] ?? { label: "Payment status unavailable", tone: "neutral" } : { label: "Not prepared", tone: "neutral" };
}
