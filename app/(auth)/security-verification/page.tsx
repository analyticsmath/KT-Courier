import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Security verification",
  description: "Security verification is not available from this page.",
  robots: { index: false, follow: false },
};

export default function SecurityVerificationPage() {
  return (
    <AuthStatusPage
      eyebrow="Security verification"
      title="Verification is not available here"
      actions={[
        { href: "/login", label: "Return to sign in" },
        { href: "/contact", label: "Contact support", kind: "secondary" },
      ]}
    >
      This account check cannot be completed from this page. Return to sign in or contact support for help.
    </AuthStatusPage>
  );
}
