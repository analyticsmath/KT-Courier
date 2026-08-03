import type { Metadata } from "next";
import { AuthStatusPage } from "@/components/public-v2/auth";

export const metadata: Metadata = {
  title: "Session expired",
  description: "Sign in again to continue to your KT Couriers account.",
  robots: { index: false, follow: false },
};

export default function SessionExpiredPage() {
  return (
    <AuthStatusPage
      eyebrow="Account access"
      title="Your session has expired"
      actions={[
        { href: "/login", label: "Sign in again" },
        { href: "/", label: "Return to site", kind: "secondary" },
      ]}
    >
      Your protected session is no longer active. Sign in again to access your account.
    </AuthStatusPage>
  );
}
