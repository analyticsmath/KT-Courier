import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Membership invoices" };

export default function MembershipInvoicesPage() {
  return <CustomerUnavailablePage eyebrow="Subscription" title="Membership invoices" description="Review membership billing evidence when subscription billing is available." stateTitle="Membership invoices are unavailable" stateDescription="No customer subscription invoice projection is available while automated subscription billing remains locked." backHref="/account/membership" backLabel="Back to membership" />;
}
