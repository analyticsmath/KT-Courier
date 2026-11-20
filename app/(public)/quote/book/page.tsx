import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
import { parcelBookingStepHref } from "@/lib/client-platform/parcel-booking-navigation";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";
import { readPublicQuote } from "@/lib/client-platform/delivery.service";
import { resolveBookingStoreId } from "@/lib/client-platform/parcel-quote-store-scope";
import { assertStoreParcelPickupMatches } from "@/lib/client-platform/store-parcel-pickup-authority";
import { membershipAllows } from "@/lib/client-platform/store-permissions";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";

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
  searchParams: Promise<{ reference?: string; workspace?: string; storeId?: string }>;
}) {
  const { reference, workspace, storeId } = await searchParams;
  if (!reference || !/^[A-Za-z0-9_-]{8,128}$/.test(reference)) redirect("/quote");
  const bookingHref = parcelBookingStepHref(reference, workspace === "store", storeId);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnUrl=${encodeURIComponent(bookingHref)}`);
  if (user.status !== "ACTIVE") redirect("/account");
  if (user.role !== "CUSTOMER" && user.role !== "STORE") redirect("/account");
  const quote = await readPublicQuote(reference, user.id).catch((error: unknown) => {
    if (error instanceof PlatformError && ["QUOTE_NOT_FOUND", "QUOTE_EXPIRED"].includes(error.code)) return null;
    throw error;
  });
  const business = user.role === "STORE" || workspace === "store" || Boolean(quote?.storeId);
  if (business && !quote) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Quote unavailable</h1><p>This quote may have expired or may belong to another session. Start a new delivery quote.</p><Link href="/store/new-delivery" className="underline">Start a new quote</Link></main>;
  if (business && quote && !quote.storeId && quote.ownerId === user.id) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">A new business quote is needed</h1><p>This quote belongs to a personal account and cannot be moved to a business. Request a new quote from the business workspace.</p><Link href="/store/new-delivery" className="underline">Start a new quote</Link></main>;
  let selectedStoreId: string | null = null;
  try {
    selectedStoreId = business ? resolveBookingStoreId(quote?.storeId ?? null, storeId ?? null) : null;
  } catch {
    return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Business does not match this quote</h1><p>Return to the business that created the quote, or request a new quote.</p><Link href="/store/new-delivery" className="underline">Start a new quote</Link></main>;
  }
  if (business && !selectedStoreId) {
    const [owned, memberships] = await Promise.all([
      prisma.store.findMany({ where: { ownerUserId: user.id, status: { notIn: ["SUSPENDED", "DISABLED"] } }, select: { id: true, name: true }, take: 10, orderBy: { name: "asc" } }),
      prisma.storeEmployeeMembership.findMany({ where: { userId: user.id, status: "ACTIVE", store: { status: "ACTIVE" } }, select: { permissions: true, store: { select: { id: true, name: true } } }, take: 10 }),
    ]);
    const stores = [...new Map([...owned, ...memberships.filter(m => membershipAllows(m.permissions, "deliveries")).map(m => m.store)].map(s => [s.id, s])).values()];
    return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Choose a business for this quote</h1><p>This older quote did not record a business. Choose the business whose saved collection address matches the quote. The address and your access will be checked again before booking.</p><ul className="space-y-3">{stores.map(store => <li key={store.id}><Link className="underline" href={parcelBookingStepHref(reference, true, store.id)}>{store.name}</Link></li>)}</ul><p>If the collection address has changed, request a new quote from that business.</p></main>;
  }
  // Store staff may have a CUSTOMER primary role but a verified business
  // workspace membership. Never silently switch their shipment to CUSTOMER.
  const storePickup = business
    ? await (
        getStorePickupAddress(user.id, "deliveries", selectedStoreId)
      ).catch((error: unknown) => {
        if (error instanceof PlatformError) return null;
        throw error;
      })
    : null;
  if (business && !storePickup) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Business access unavailable</h1><p>Check that you have delivery access to this business and that it is not suspended.</p>{!quote?.storeId && <Link className="underline" href={parcelBookingStepHref(reference, true)}>Choose another business</Link>}</main>;
  if (business && quote && !quote.storeId && storePickup) {
    const pickup = (quote.metadata as { bookingInput?: { pickupAddress?: Parameters<typeof assertStoreParcelPickupMatches>[0] } } | null)?.bookingInput?.pickupAddress ?? {};
    try { assertStoreParcelPickupMatches(pickup, storePickup.pickupAddress); }
    catch (error) {
      if (!(error instanceof PlatformError)) throw error;
      return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">A new quote is needed</h1><p>This older quote does not match the selected business’s current verified collection address. Request a new quote for this business.</p><Link className="underline" href={`/store/new-delivery?storeId=${encodeURIComponent(storePickup.store.id)}`}>Start a new quote</Link></main>;
    }
  }

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
        storeContextId={storePickup?.store?.id ?? null}
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
