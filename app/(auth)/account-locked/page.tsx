import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Account access restricted",
  description: "Get help with restricted access to a KT Couriers account.",
  robots: { index: false, follow: false },
};

export default function AccountLockedPage() {
  return (
    <AuthStatusPage
      eyebrow="Account access"
      title="Access is temporarily restricted"
      actions={[
        { href: "/contact", label: "Contact support" },
        { href: "/login", label: "Return to sign in", kind: "secondary" },
      ]}
    >
      Contact support for help with access to your account.
    </AuthStatusPage>
  );
}
