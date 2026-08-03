import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperationalPanel, ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { PayfastAutoSubmitForm } from "@/components/payments/PayfastAutoSubmitForm";
import { requireAuth } from "@/lib/auth/guards";
import { buildOwnedPayfastCheckoutAction } from "@/lib/services/payfast-checkout.service";
import { PayfastCheckoutParamsSchema } from "@/lib/validation/payments";

export const metadata: Metadata = {
  title: "Continue to Payfast",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PayfastCheckoutPage({
  params,
}: {
  params: Promise<{ attemptReference: string }>;
}) {
  const user = await requireAuth();
  const parsed = PayfastCheckoutParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let action: Awaited<ReturnType<typeof buildOwnedPayfastCheckoutAction>>;
  try {
    action = await buildOwnedPayfastCheckoutAction(user.id, parsed.data.attemptReference);
  } catch {
    notFound();
  }
  return (
    <ProtectedPageFrame className="max-w-xl">
      <ProtectedPageHeader eyebrow="Payfast Sandbox" title="Continue to Payfast" description="You are leaving KT Couriers for the secure Payfast sandbox checkout." />
      <OperationalPanel className="space-y-4">
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">Payfast Sandbox — no real money will be transferred</p>
        <PayfastAutoSubmitForm actionUrl={action.url} fields={action.fields} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
