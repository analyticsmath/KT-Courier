import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Access is temporarily restricted",
  description: "Get help with restricted access to a KT Couriers account.",
  robots: { index: false, follow: false },
};

export default function AccountLockedPage() {
  return (
    <AuthStatusPage
      actions={[
        { href: "/contact", label: "Contact support" },
        { href: "/login", label: "Return to sign in", kind: "secondary" },
      ]}
      title="Access is temporarily restricted"
    >
      Contact support for help with access to your account.
    </AuthStatusPage>
  );
}
