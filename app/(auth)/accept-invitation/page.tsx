import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Invitation unavailable",
  description: "Get help with a KT Couriers account invitation.",
  robots: { index: false, follow: false },
};

export default function AcceptInvitationPage() {
  return (
    <AuthStatusPage
      eyebrow="Account invitation"
      title="This invitation is unavailable"
      actions={[
        { href: "/contact", label: "Contact support" },
        { href: "/login", label: "Return to sign in", kind: "secondary" },
      ]}
    >
      This invitation cannot be completed from this page. Contact support if you need help with account access.
    </AuthStatusPage>
  );
}
