import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader, ProtectedStatus } from "@/components/protected-v2";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";
import { getCustomerPaymentStatusPresentation } from "@/lib/payment-presentation/payment-status";

export const metadata: Metadata = { title: "Payfast checkout not completed", robots: { index: false, follow: false, nocache: true } };

export default async function PayfastCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const user = await requireAuth();
  const query = await searchParams;
  const parsed = CustomerPaymentParamsSchema.safeParse({ publicReference: query.payment });
  if (!parsed.success) notFound();
  const payment = await getCustomerPaymentStatus(user.id, parsed.data.publicReference);
  if (!payment) notFound();
  return (
    <ProtectedPageFrame className="max-w-xl">
      <ProtectedPageHeader eyebrow="Checkout navigation" title="No final result is confirmed" description={payment.orderReference} />
      <OperationalPanel className="space-y-4">
        <p className="font-semibold text-[var(--kt-ink-navy)]">The Payfast checkout was not completed in this browser. No final payment result has been confirmed yet.</p>
        <p className="text-sm text-[var(--kt-text-muted)]">This page has not cancelled the payment or order, removed anything, or requested a return of funds.</p>
        <p className="text-sm text-[var(--eo-text-secondary)]">Current payment state: <ProtectedStatus {...getCustomerPaymentStatusPresentation(payment.status)} /></p>
        <Link href={`/orders/${encodeURIComponent(payment.orderReference)}/payment`} className="eo-text-link">Back to payment details</Link>
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
