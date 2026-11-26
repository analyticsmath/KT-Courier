import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProtectedPageFrame } from "@/components/protected-v2";
import { PaystackReturnContent } from "@/components/payments/PaystackReturnContent";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerPaymentStatus, getOwnedPaymentIdentity } from "@/lib/services/payment-customer-query.service";
import { hasPaystackCallbackReference } from "@/lib/payments/providers/paystack/paystack-callback-urls";
import { recoverPendingPaystackPaymentForPaymentId } from "@/lib/services/paystack-verify-recovery.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaystackReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment?: string | string[];
    status?: string | string[];
    trxref?: string | string[];
    reference?: string | string[];
  }>;
}) {
  const user = await requireAuth();
  const query = await searchParams;
  const parsed = CustomerPaymentParamsSchema.safeParse({ publicReference: query.payment });
  if (!parsed.success) notFound();
  let payment = await getCustomerPaymentStatus(user.id, parsed.data.publicReference);
  if (!payment) notFound();

  const isCancelled = query.status === "cancelled";
  if (!isCancelled && hasPaystackCallbackReference(query) && ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(payment.status)) {
    const identity = await getOwnedPaymentIdentity(user.id, parsed.data.publicReference).catch(() => null);
    if (identity) {
      const recovery = await recoverPendingPaystackPaymentForPaymentId(identity.id, {
        trigger: "parcel_paystack_return",
      }).catch(() => null);
      if (recovery?.recovered || recovery?.outcome === "FAILED_VIA_VERIFY" || recovery?.outcome === "APPLIED_WEBHOOK") {
        payment = (await getCustomerPaymentStatus(user.id, parsed.data.publicReference)) ?? payment;
      }
    }
  }

  return <ProtectedPageFrame className="max-w-xl">
    <PaystackReturnContent initialPayment={payment} cancelledInBrowser={isCancelled} />
  </ProtectedPageFrame>;
}
