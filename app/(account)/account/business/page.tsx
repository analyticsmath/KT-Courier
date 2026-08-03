import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Business account" };

export default function BusinessAccountPage() {
  return <CustomerUnavailablePage eyebrow="Business account" title="Business team" description="Manage team logistics access when a connected business-account authority is available." stateTitle="Business team management is unavailable" stateDescription="This route has no connected business-team projection or member-management workflow." />;
}
