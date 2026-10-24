"use client";

import Link from "next/link";
import type { CustomerPaymentStatusDto } from "@/lib/dto/payment.dto";
import { useCustomerPaymentPolling } from "@/components/payments/PaymentStatusPoller";
import { OperationalPanel, ProtectedPageHeader } from "@/components/protected-v2";
import { resolvePaystackReturnPresentation } from "@/lib/payment-presentation/paystack-return-presentation";
import { getCustomerPaymentStatusPresentation } from "@/lib/payment-presentation/payment-status";

export function PaystackReturnContent({ initialPayment, cancelledInBrowser }: {
  initialPayment: CustomerPaymentStatusDto;
  cancelledInBrowser: boolean;
}) {
  const payment = useCustomerPaymentPolling(initialPayment);
  const view = resolvePaystackReturnPresentation(payment.status, cancelledInBrowser);
  return <>
    <ProtectedPageHeader eyebrow="Secure confirmation" title={view.title} description={payment.orderReference} />
    <OperationalPanel className="space-y-4">
      <p className="font-semibold text-[var(--kt-ink-navy)]" role="status" aria-live="polite">{view.description}</p>
      <p className="text-sm text-[var(--kt-text-muted)]">
        A browser return is not proof of payment. Order fulfilment and accounting records are updated only after verified provider confirmation.
      </p>
      <p className="text-sm text-[var(--kt-text-muted)]" aria-live="polite">Current payment state: <strong>{getCustomerPaymentStatusPresentation(payment.status).label}</strong></p>
      <div className="flex flex-wrap gap-4 pt-2">
        <Link href={`/orders/${encodeURIComponent(payment.orderReference)}/payment`} className="eo-text-link text-sm font-semibold">Payment details</Link>
        <Link href={`/track?reference=${encodeURIComponent(payment.orderReference)}`} className="eo-text-link text-sm font-semibold">
          {payment.status === "SUCCEEDED" ? "Track your delivery" : "View order status"}
        </Link>
      </div>
    </OperationalPanel>
  </>;
}
