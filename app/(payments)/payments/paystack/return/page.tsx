import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { PaymentStatusPoller } from "@/components/payments/PaymentStatusPoller";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

export const metadata: Metadata = {
  title: "Payment confirmation pending",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaystackReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string | string[]; status?: string | string[] }>;
}) {
  const user = await requireAuth();
  const query = await searchParams;
  const parsed = CustomerPaymentParamsSchema.safeParse({ publicReference: query.payment });
  if (!parsed.success) notFound();
  const payment = await getCustomerPaymentStatus(user.id, parsed.data.publicReference);
  if (!payment) notFound();

  const isCancelled = query.status === "cancelled";

  return (
    <ProtectedPageFrame className="max-w-xl">
      <ProtectedPageHeader
        eyebrow="Secure confirmation"
        title={isCancelled ? "Payment cancelled" : "We are checking your payment"}
        description={payment.orderReference}
      />
      <OperationalPanel className="space-y-4">
        <p className="font-semibold text-[var(--kt-ink-navy)]">
          {isCancelled
            ? "You returned from Paystack without completing payment."
            : "You have returned from Paystack. We are waiting for secure payment confirmation."}
        </p>
        <p className="text-sm text-[var(--kt-text-muted)]">
          A browser return is not proof of payment. Order fulfillment and accounting records are updated only after verified provider confirmation.
        </p>
        {!isCancelled && <PaymentStatusPoller initialPayment={payment} />}
        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href={`/orders/${encodeURIComponent(payment.orderReference)}/payment`}
            className="eo-text-link text-sm font-semibold"
          >
            Back to payment details
          </Link>
          <Link
            href={`/checkout/${encodeURIComponent(payment.orderReference)}/status`}
            className="eo-text-link text-sm font-semibold"
          >
            View order status
          </Link>
        </div>
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
