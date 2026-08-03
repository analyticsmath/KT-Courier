import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthRouteIntro } from "@/components/public-v2/auth";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a customer or business account with KT Couriers.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <>
      <AuthRouteIntro eyebrow="New account" title="Start a secure handoff">
        Choose the account that matches how you send or manage deliveries.
      </AuthRouteIntro>
      <Suspense fallback={<p>Loading account options…</p>}>
        <SignupForm />
      </Suspense>
    </>
  );
}
