import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyOtpForm } from "./VerifyOtpForm";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Verify your email to complete your KT Couriers account setup.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ email?: string }>;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "your email address";
  return `${localPart.slice(0, 1)}${"•".repeat(Math.min(Math.max(localPart.length - 1, 2), 5))}@${domain}`;
}

export default async function VerifyOtpPage({ searchParams }: Props) {
  const { email } = await searchParams;
  if (!email) redirect("/signup");

  const verifiedEmail = decodeURIComponent(email);
  return <VerifyOtpForm email={verifiedEmail} maskedEmail={maskEmail(verifiedEmail)} />;
}
