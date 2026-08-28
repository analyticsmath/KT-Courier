import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "This invitation is unavailable",
  description: "Get help with a KT Couriers account invitation.",
  robots: { index: false, follow: false },
};

export default function AcceptInvitationPage() {
  return (
    <AuthStatusPage
      actions={[
        { href: "/contact", label: "Contact support" },
        { href: "/login", label: "Return to sign in", kind: "secondary" },
      ]}
      title="This invitation is unavailable"
    >
      This invitation cannot be completed from this page. Contact support if you need help with account access.
    </AuthStatusPage>
  );
}
