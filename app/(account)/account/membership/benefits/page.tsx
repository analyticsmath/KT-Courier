import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Membership benefits" };

export default function MembershipBenefitsPage() {
  return <CustomerUnavailablePage eyebrow="Subscription" title="Membership benefits" description="Review benefit usage when an active subscription contract exists." stateTitle="Membership benefits are unavailable" stateDescription="No active customer entitlement projection is available on this route." backHref="/account/membership" backLabel="Back to membership" />;
}
