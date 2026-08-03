import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Payment methods" };

export default function PaymentMethodsPage() {
  return <CustomerUnavailablePage eyebrow="Customer payments" title="Payment methods" description="Review saved payment methods when this capability is available." stateTitle="Saved payment methods are unavailable" stateDescription="This account does not have a customer-safe saved-payment-method projection or card-management workflow in the current product state." backHref="/account" />;
}
