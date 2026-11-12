import Link from "next/link";
import type { ParcelPaymentMethod } from "@/components/forms/ParcelPaymentChoice";

/** A server-confirmed booking must remain actionable even if router.push fails. */
export function ParcelBookedNextStep({ href, paymentMethod }: {
  href: string;
  paymentMethod: ParcelPaymentMethod;
}) {
  const needsDigitalPayment = paymentMethod !== "FULL_COD";
  return (
    <div className="sm:col-span-2 space-y-2 rounded-xl border border-[var(--kt-border-strong)] bg-[var(--kt-surface-muted)] p-4" role="status">
      <p className="font-semibold text-[var(--kt-brand-navy)]">Your parcel booking was created.</p>
      <p className="text-sm text-[var(--kt-text-soft)]">
        {needsDigitalPayment
          ? "Payment is not yet confirmed. Continue to the secure payment page to complete your booking."
          : "Your approved cash-on-delivery booking is saved. You can review its details now."}
      </p>
      <Link className="inline-flex min-h-11 items-center rounded-lg bg-[var(--kt-brand-blue)] px-4 text-sm font-bold text-white underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={href}>
        {needsDigitalPayment ? "Continue to secure card payment" : "View parcel booking"}
      </Link>
    </div>
  );
}
