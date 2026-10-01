import { safeAuthReturnUrl } from "@/lib/auth/return-url";
import type { Metadata } from "next";
import { AuthFlowLinks, AuthRouteIntro } from "@/components/public-v2/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Securely sign in to your KT Couriers account.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const returnUrl = safeAuthReturnUrl((await searchParams).returnUrl);
  return (
    <>
      <AuthRouteIntro title="Welcome back">
        Sign in to continue to your KT account.
      </AuthRouteIntro>
      <LoginForm returnUrl={returnUrl} />
      <AuthFlowLinks
        links={[
          {
            href: returnUrl
              ? `/signup?returnUrl=${encodeURIComponent(returnUrl)}`
              : "/signup",
            label: "Create an account",
          },
          { href: "/forgot-password", label: "Forgot password?" },
        ]}
      />
    </>
  );
}
