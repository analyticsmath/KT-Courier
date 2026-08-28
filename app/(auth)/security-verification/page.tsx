import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Verification is not available here",
  description: "Security verification is not available from this page.",
  robots: { index: false, follow: false },
};

export default function SecurityVerificationPage() {
  return (
    <AuthStatusPage
      actions={[
        { href: "/login", label: "Return to sign in" },
        { href: "/contact", label: "Contact support", kind: "secondary" },
      ]}
      title="Verification is not available here"
    >
      Return to sign in or contact support for help with this account check.
    </AuthStatusPage>
  );
}
