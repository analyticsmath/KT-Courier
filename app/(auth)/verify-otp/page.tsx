import { safeAuthReturnUrl } from "@/lib/auth/return-url";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyOtpForm } from "./VerifyOtpForm";

export const metadata: Metadata = {
  title: "Check your email",
  description:
    "Enter your verification code to access your KT Couriers account.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{
    email?: string;
    returnUrl?: string;
    delivery?: string;
  }>;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "your email address";
  return `${localPart.slice(0, 1)}${"•".repeat(Math.min(Math.max(localPart.length - 1, 2), 5))}@${domain}`;
}

export default async function VerifyOtpPage({ searchParams }: Props) {
  const { email, returnUrl, delivery } = await searchParams;
  if (!email) redirect("/signup");

  const verifiedEmail = email;
  return (
    <VerifyOtpForm
      email={verifiedEmail}
      maskedEmail={maskEmail(verifiedEmail)}
      returnUrl={safeAuthReturnUrl(returnUrl)}
      deliveryPending={delivery === "pending"}
    />
  );
}
