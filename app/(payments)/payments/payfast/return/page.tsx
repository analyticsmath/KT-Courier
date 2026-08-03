import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { PaymentStatusPoller } from "@/components/payments/PaymentStatusPoller";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

export const metadata: Metadata = { title: "Payment confirmation pending", robots: { index: false, follow: false, nocache: true } };

export default async function PayfastReturnPage({
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
      <ProtectedPageHeader eyebrow="Secure confirmation" title="We are checking your payment" description={payment.orderReference} />
      <OperationalPanel className="space-y-4">
        <p className="font-semibold text-[var(--kt-ink-navy)]">You have returned from Payfast. We are waiting for secure payment confirmation.</p>
        <p className="text-sm text-[var(--kt-text-muted)]">A browser return is not proof of payment. The order and accounting records have not been changed by this page.</p>
        <PaymentStatusPoller initialPayment={payment} />
        <Link href={`/orders/${encodeURIComponent(payment.orderReference)}/payment`} className="eo-text-link">Back to payment details</Link>
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
