import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader, ProtectedStatus } from "@/components/protected-v2";
import { PaymentCheckoutClient } from "@/components/payments/PaymentCheckoutClient";
import { requireAuth } from "@/lib/auth/guards";
import { listPaymentProviders } from "@/lib/services/payment-query.service";
import { getCustomerPaymentPage } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentPageParamsSchema } from "@/lib/validation/payments";
import { getCustomerPaymentStatusPresentation } from "@/lib/payment-presentation/payment-status";

export const metadata: Metadata = {
  title: "Order payment",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderPaymentPage({
  params,
}: {
  params: Promise<{ orderReference: string }>;
}) {
  const user = await requireAuth();
  const parsed = CustomerPaymentPageParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const page = await getCustomerPaymentPage(user, parsed.data.orderReference);
  if (!page) notFound();
  const payfast = listPaymentProviders().data.find((entry) => entry.code === "PAYFAST");
  if (!payfast) notFound();

  return (
    <ProtectedPageFrame className="max-w-2xl">
      <ProtectedPageHeader
        eyebrow="Secure payment"
        title={`Pay for ${page.orderReference}`}
        description="The payable amount is taken from the confirmed server-side order quote."
      />
      <OperationalPanel className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Order reference</dt><dd className="mt-1 font-bold">{page.orderReference}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Amount</dt><dd className="mt-1 font-mono text-xl font-black">ZAR {page.amount}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-[var(--eo-text-muted)]">Payment status</dt><dd className="mt-1"><ProtectedStatus {...getCustomerPaymentStatusPresentation(page.payment?.status)} /></dd></div>
          <div><dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">Provider</dt><dd className="mt-1">Payfast</dd></div>
        </dl>
        <PaymentCheckoutClient
          orderId={page.orderId}
          orderReference={page.orderReference}
          initialPayment={page.payment}
          provider={{ active: payfast.active, environment: payfast.environment, blockReason: payfast.blockReason }}
        />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
