import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { storeAccess } from "@/lib/client-platform/store-access";
import { normalizeParcelTrackingReference } from "@/lib/tracking/parcel-tracking-reference";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track a parcel | KT Couriers",
  description: "Find your KT Couriers parcel using its short tracking number.",
  robots: { index: false, follow: false },
};

export default async function ParcelTrackingLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; workspace?: string }>;
}) {
  const params = await searchParams;
  const raw = typeof params.reference === "string" ? params.reference : "";
  const reference = normalizeParcelTrackingReference(raw);
  const entered = raw.trim().length > 0;
  const storeWorkspace = params.workspace === "store";
  const user = await getCurrentUser();
  const signedIn = user?.status === "ACTIVE" && (user.role === "CUSTOMER" || user.role === "STORE");
  let notOwned = false;

  if (reference && signedIn && user) {
    const business = storeWorkspace || user.role === "STORE";
    if (business) {
      const access = await storeAccess(user.id, "deliveries").catch(() => null);
      if (access) {
        const order = await prisma.order.findFirst({
          where: { orderNumber: reference, storeId: access.store.id },
          select: { id: true },
        });
        if (order) redirect(`/store/orders/${encodeURIComponent(order.id)}`);
      }
    } else {
      const order = await prisma.order.findFirst({
        where: { orderNumber: reference, customerId: user.id },
        select: { id: true },
      });
      if (order) redirect(`/account/orders/${encodeURIComponent(order.id)}`);
    }
    // Identical response for unknown references and references owned by others.
    notOwned = true;
  }

  return <section className="mx-auto w-full max-w-3xl px-6 pb-24 pt-36 text-[var(--kt-public-text-primary)]" aria-labelledby="track-parcel-title">
    <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--kt-public-text-secondary)]">KT Couriers · Parcel delivery</p>
    <h1 id="track-parcel-title" className="text-4xl font-semibold leading-tight sm:text-5xl">Track your parcel.</h1>
    <p className="mb-8 mt-5 max-w-xl text-base leading-7 text-[var(--kt-public-text-secondary)]">
      Enter the reference from your booking. Your delivery progress, latest permitted courier location and proof of delivery are shown securely in the account that booked the parcel.
    </p>
    <form method="GET" action="/track" className="space-y-5 rounded-2xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-primary)] p-6">
      <div>
        <label htmlFor="parcel-tracking-number" className="mb-2 block text-sm font-semibold">Tracking number</label>
        <input id="parcel-tracking-number" type="text" name="reference" maxLength={40} required
          value={raw.slice(0, 40)} readOnly={false}
          placeholder="KT-2026-123456" autoComplete="off" spellCheck={false}
          className="w-full rounded-lg border border-[var(--kt-public-border-default)] bg-transparent px-4 py-3 font-mono text-base uppercase tracking-wider"
        />
        <p className="mt-2 text-xs text-[var(--kt-public-text-secondary)]">New parcel references are short and start with KT. A tracking number by itself does not give strangers access to customer addresses or live driver location.</p>
      </div>
      {storeWorkspace && <input type="hidden" name="workspace" value="store" />}
      <button type="submit" className="min-h-11 rounded-lg bg-[var(--kt-public-action-primary)] px-6 py-3 font-semibold text-[var(--kt-public-text-inverse)]">View delivery</button>
    </form>
    {entered && !reference && <p className="mt-5 text-sm" role="alert">Check your tracking number and try again. You can also open the delivery from your account order history.</p>}
    {entered && reference && !signedIn && <div className="mt-6" role="status">
      <p className="text-sm">Sign in to the account that booked this delivery to see its location and proof of delivery.</p>
      <Link href="/login" className="mt-3 inline-flex underline underline-offset-4">Sign in securely</Link>
    </div>}
    {notOwned && <p className="mt-5 text-sm" role="status">No parcel with that reference was found in this account. Confirm your tracking number or switch to the correct account/workspace.</p>}
    {signedIn && <p className="mt-6 text-sm text-[var(--kt-public-text-secondary)]">
      Tracking a {storeWorkspace || user?.role === "STORE" ? "store" : "personal"} delivery. {user?.role === "CUSTOMER" &&
      <Link href={storeWorkspace ? "/track" : "/track?workspace=store"} className="underline underline-offset-4">
        Switch to {storeWorkspace ? "personal" : "store"} tracking
      </Link>}
    </p>}
  </section>;
}
