import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  OperationalPanel,
  ProtectedPageFrame,
  ProtectedPageHeader,
  ProtectedStatus,
} from "@/components/protected-v2";
import { PaymentCheckoutClient } from "@/components/payments/PaymentCheckoutClient";
import { requireAuth } from "@/lib/auth/guards";
import { resolveQaAcceptanceSessionContext } from "@/lib/qa-acceptance/access";
import { buildQaSandboxProviderReadiness } from "@/lib/qa-acceptance/config";
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
  const qaCtx = page.isQaAcceptance
    ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null)
    : null;
  const providerConfig = page.isQaAcceptance
    ? (qaCtx
        ? buildQaSandboxProviderReadiness().find((entry) => entry.code === "PAYSTACK")
        : {
            code: "PAYSTACK" as const,
            environment: "sandbox" as const,
            blockReason: "QA_ACCEPTANCE_INACTIVE",
            checkoutReadiness: { ready: false },
            eftReadiness: { ready: false },
          })
    : listPaymentProviders().data.find((entry) => entry.code === "PAYSTACK");
  if (!providerConfig) notFound();

  const effectiveCanCheckout = page.isQaAcceptance && !qaCtx ? false : page.canCheckout;
  const effectiveBlockReason =
    page.isQaAcceptance && !qaCtx
      ? "QA sandbox payment is restricted to active enrolled QA acceptance accounts."
      : page.checkoutBlockReason;

  return (
    <ProtectedPageFrame className="max-w-2xl">
      <ProtectedPageHeader
        eyebrow="Secure payment"
        title={`Pay for ${page.orderReference}`}
        description="The payable amount is taken from the confirmed server-side order quote."
      />
      <OperationalPanel className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">
              Order reference
            </dt>
            <dd className="mt-1 font-bold">{page.orderReference}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">
              Amount
            </dt>
            <dd className="mt-1 font-mono text-xl font-black">
              ZAR {page.amount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-[var(--eo-text-muted)]">
              Payment status
            </dt>
            <dd className="mt-1">
              <ProtectedStatus
                {...getCustomerPaymentStatusPresentation(page.payment?.status)}
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-[var(--kt-text-muted)]">
              Provider
            </dt>
            <dd className="mt-1">Paystack</dd>
          </div>
        </dl>
        {effectiveCanCheckout === false ? (
          <p role="status" className="text-sm">
            {effectiveBlockReason}
          </p>
        ) : (
          <PaymentCheckoutClient
            orderId={page.orderId}
            orderReference={page.orderReference}
            initialPayment={page.payment}
            provider={{
              active: providerConfig.checkoutReadiness.ready,
              eftActive: providerConfig.eftReadiness.ready,
              environment: providerConfig.environment,
              blockReason: providerConfig.blockReason,
            }}
          />
        )}
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
