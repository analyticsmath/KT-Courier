import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProtectedPageFrame } from "@/components/protected-v2";
import { PaystackReturnContent } from "@/components/payments/PaystackReturnContent";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

export const metadata: Metadata = {
  title: "Payment status",
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

  return <ProtectedPageFrame className="max-w-xl">
    <PaystackReturnContent initialPayment={payment} cancelledInBrowser={isCancelled} />
  </ProtectedPageFrame>;
}
