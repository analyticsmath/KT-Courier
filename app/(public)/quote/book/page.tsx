import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
import { parcelBookingStepHref } from "@/lib/client-platform/parcel-booking-navigation";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Complete your delivery | KT Couriers",
  description: "Confirm your parcel contacts and eligible payment method after receiving a quote.",
  robots: { index: false, follow: false },
};

/** Dedicated post-login step; quote, pricing and ownership remain API-authoritative. */
export default async function CompleteParcelBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; workspace?: string }>;
}) {
  const { reference, workspace } = await searchParams;
  if (!reference || !/^[A-Za-z0-9_-]{8,128}$/.test(reference)) redirect("/quote");
  const bookingHref = parcelBookingStepHref(reference, workspace === "store");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(bookingHref)}`);
  if (user.role !== "CUSTOMER" && user.role !== "STORE") redirect("/account");
  const business = user.role === "STORE" || workspace === "store";
  // Store staff may have a CUSTOMER primary role but a verified business
  // workspace membership. Never silently switch their shipment to CUSTOMER.
  const storePickup = business
    ? await getStorePickupAddress(user.id, "deliveries").catch(() => null)
    : null;
  if (business && !storePickup) redirect("/store/workspace");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-[var(--kt-brand-navy)] sm:px-6 sm:py-12" id="main-content">
      <nav aria-label="Booking progress" className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--kt-text-soft)]">
        <span className="rounded-full border border-[var(--kt-border-strong)] bg-white px-3 py-2">1 · Quote confirmed</span>
        <span aria-current="step" className="rounded-full bg-[var(--kt-brand-navy)] px-3 py-2 text-white">2 · Delivery details</span>
        <span className="rounded-full border border-[var(--kt-border-strong)] bg-white px-3 py-2">3 · Payment</span>
      </nav>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--kt-brand-blue)]">Your delivery quotation is ready</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Complete your delivery</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--kt-text-soft)] sm:text-base">
            Confirm the sender and recipient contacts, then choose an available payment method.
            Your quoted price is checked again by the server before any order is created.
          </p>
        </div>
        <Link href="/quote" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--kt-border-strong)] bg-white px-4 text-sm font-semibold underline underline-offset-4">
          Start a new quote
        </Link>
      </div>
      <PublicDeliveryQuoteForm
        signedIn
        business={business}
        bookingOnly
        reference={reference}
        senderDefaults={{
          name: storePickup?.pickupAddress?.contactName ?? storePickup?.store?.contactName ?? user.name,
          phone: storePickup?.pickupAddress?.contactPhone ?? storePickup?.store?.contactPhone,
          email: user.email,
        }}
      />
      <p className="mt-5 text-xs leading-6 text-[var(--kt-text-soft)]">
        Your delivery is not paid merely by submitting this form. Online payments are completed
        through secure Paystack checkout and verified by KT Couriers before dispatch.
      </p>
    </main>
  );
}
