import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Membership" };

export default function AccountMembershipPage() {
  return <CustomerUnavailablePage eyebrow="Subscription" title="Membership" description="Review subscription state when subscription operations are available." stateTitle="Online membership subscriptions are unavailable" stateDescription="Buying plans, managing a membership, and recurring billing remain disabled until the existing subscription production validation is approved." />;
}
