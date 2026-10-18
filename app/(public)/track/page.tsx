import styles from "@/components/public-v3/foundation/utility-experience.module.css";
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

  return <section className={styles.utility} aria-labelledby="track-parcel-title">
    <div className={styles.inner}>
    <header className={styles.head}>
      <h1 id="track-parcel-title" className={styles.title}>Track your delivery.</h1>
      <p className={styles.description}>
        Enter the tracking reference from your booking. Delivery details, permitted location data and proof of delivery remain protected in the account that placed the order.
      </p>
    </header>
    <div className={styles.body}>
    <form method="GET" action="/track" className={styles.referenceBox}>
      <div>
        <label htmlFor="parcel-tracking-number" className="mb-2 block text-sm font-semibold">Tracking number</label>
        <input id="parcel-tracking-number" type="text" name="reference" maxLength={40} required
          defaultValue={raw.slice(0, 40)}
          placeholder="KT-2026-123456" autoComplete="off" spellCheck={false}
          className="font-mono uppercase tracking-wider"
        />
        <p className="mt-2 text-xs text-[var(--kt-public-text-secondary)]">New parcel references are short and start with KT. A tracking number by itself does not give strangers access to customer addresses or live driver location.</p>
      </div>
      {storeWorkspace && <input type="hidden" name="workspace" value="store" />}
      <button type="submit" >View delivery</button>
    </form>
    {entered && !reference && <p className={styles.result} role="alert">Check your tracking number and try again. You can also open the delivery from your account order history.</p>}
    {entered && reference && !signedIn && <div className={styles.result} role="status">
      <p className="text-sm">Sign in to the account that booked this delivery to see its location and proof of delivery.</p>
      <Link href="/login" className="mt-3 inline-flex underline underline-offset-4">Sign in securely</Link>
    </div>}
    {notOwned && <p className={styles.result} role="status">No parcel with that reference was found in this account. Confirm your tracking number or switch to the correct account/workspace.</p>}
    {signedIn && <p className={styles.result}>
      Tracking a {storeWorkspace || user?.role === "STORE" ? "store" : "personal"} delivery. {user?.role === "CUSTOMER" &&
      <Link href={storeWorkspace ? "/track" : "/track?workspace=store"} className="underline underline-offset-4">
        Switch to {storeWorkspace ? "personal" : "store"} tracking
      </Link>}
    </p>}
    </div>
    </div>
  </section>;
}
