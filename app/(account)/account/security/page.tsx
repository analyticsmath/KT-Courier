import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return <CustomerUnavailablePage eyebrow="Account security" title="Security" description="Review active sessions and security controls when a customer-safe session projection is available." stateTitle="Session controls are unavailable" stateDescription="This route does not have a connected customer session list or session-revocation authority. Password resets continue through the existing secure reset flow." backHref="/forgot-password" backLabel="Reset password" />;
}
