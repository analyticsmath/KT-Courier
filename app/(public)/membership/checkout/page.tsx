import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Membership checkout unavailable",
  description: "Online membership checkout is not currently available.",
  alternates: { canonical: "/membership/checkout" },
  robots: { index: false, follow: false },
};

export default function MembershipCheckoutPage() {
  return (
    <main className="container-public py-16">
      <div className="max-w-2xl border-l-4 border-[var(--kt-public-signal)] bg-[var(--kt-public-canvas-secondary)] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--kt-public-signal)]">Membership</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--kt-public-text-primary)]">Online membership checkout is not currently available.</h1>
        <p className="mt-4 leading-7 text-[var(--kt-public-text-secondary)]">No payment has been requested on this route. Contact KT Couriers for current information, or return to delivery services for a quote request.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center bg-[var(--kt-public-signal)] px-4 text-sm font-semibold text-white" href="/contact">Contact KT Couriers</Link>
          <Link className="inline-flex min-h-11 items-center border border-[var(--kt-public-text-primary)] px-4 text-sm font-semibold" href="/membership">Membership information</Link>
        </div>
      </div>
    </main>
  );
}
