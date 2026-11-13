import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { resolveLiveGatewayVerificationConfiguration } from "@/lib/payments/live-gateway-verification.service";
import { LiveGatewayVerificationPanel } from "@/components/admin/LiveGatewayVerificationPanel";

export const metadata: Metadata = { title: "R1 Live Paystack Verification | KT Couriers" };
export const dynamic = "force-dynamic";

export default async function LiveGatewayVerificationPage() {
  await requireRole(UserRole.SUPER_ADMIN);
  const configuration = resolveLiveGatewayVerificationConfiguration();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-2 pb-12">
      <ProtectedPageHeader
        eyebrow="Superadmin · payment diagnostic"
        title="Verify a real R1.00 Paystack payment"
        description="A controlled one-time card payment using KT Couriers' actual Paystack merchant account."
      />
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <strong>This charges real money.</strong> Your card will be charged R1.00 ZAR if you complete payment.
        No parcel is booked and no delivery, wallet credit, refund, or payout is triggered.
        This verifies the payment gateway, not the separate courier order and financial-ledger processes.
      </div>
      <LiveGatewayVerificationPanel eligible={configuration.eligible} reason={configuration.reason} />
      <p className="text-sm text-slate-600">
        Once paid, compare the Paystack reference and R1.00 amount in your Command Center.
        The application verifies that same reference, amount, currency and live environment through Paystack.
      </p>
      <Link href="/admin/payment-providers" className="text-sm underline underline-offset-4">Back to payment providers</Link>
    </div>
  );
}
