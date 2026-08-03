import type { Metadata } from "next";
import { AuthFlowLinks, AuthRouteIntro } from "@/components/public-v2/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Securely sign in to your KT Couriers account.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <AuthRouteIntro eyebrow="Account access" title="Welcome back">
        Sign in to continue with your delivery account.
      </AuthRouteIntro>
      <LoginForm />
      <AuthFlowLinks links={[
        { href: "/signup", label: "Create an account" },
        { href: "/forgot-password", label: "Forgot password?" },
      ]} />
    </>
  );
}
