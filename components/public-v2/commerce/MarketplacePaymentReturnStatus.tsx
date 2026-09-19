"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const TERMINAL = new Set(["COMPLETED", "CANCELLED", "EXPIRED", "RECONCILIATION_REQUIRED"]);

function statusCopy(status: string, cancelled: boolean): { title: string; body: string } {
  if (cancelled) {
    return {
      title: "Payment cancelled",
      body: "No payment success is assumed from the browser return. You can return to checkout and try again.",
    };
  }
  if (status === "COMPLETED") {
    return {
      title: "Payment confirmed",
      body: "Your payment was verified by Paystack and the marketplace order has been finalized.",
    };
  }
  if (status === "RECONCILIATION_REQUIRED") {
    return {
      title: "Payment received — order review in progress",
      body: "The payment is safely recorded, but order finalization needs reconciliation before fulfilment proceeds.",
    };
  }
  return {
    title: "We are confirming your payment",
    body: "A browser return is not proof of payment. KT Couriers will finalize the order only after server-side Paystack verification.",
  };
}

export function MarketplacePaymentReturnStatus({
  checkoutReference,
  initialStatus,
  cancelled,
}: {
  checkoutReference: string;
  initialStatus: string;
  cancelled: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (cancelled || TERMINAL.has(status)) return;

    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 24) {
        window.clearInterval(timer);
        return;
      }
      try {
        const response = await fetch(
          `/api/checkout/${encodeURIComponent(checkoutReference)}/status`,
          { cache: "no-store", headers: { Accept: "application/json" } },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { checkout?: { status?: string } };
        const next = payload.checkout?.status;
        if (!next) return;
        setStatus(next);
        if (TERMINAL.has(next)) window.clearInterval(timer);
      } catch {
        // The next polling interval may recover.
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [cancelled, checkoutReference, status]);

  const copy = useMemo(() => statusCopy(status, cancelled), [status, cancelled]);

  return (
    <section className="mx-auto max-w-2xl px-6 pb-20 pt-28">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--kt-brand-blue)]">
        Secure marketplace payment
      </p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{copy.title}</h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-[var(--kt-graphite)]">{copy.body}</p>

      <div className="mt-8 border border-[var(--kt-concrete)] bg-white p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">Checkout reference</p>
        <p className="mt-1 font-mono text-sm">{checkoutReference}</p>
        <p className="mt-4 text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">Current status</p>
        <p className="mt-1 text-sm font-semibold">{status.replaceAll("_", " ")}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/checkout?ref=${encodeURIComponent(checkoutReference)}`}
          className="inline-flex items-center bg-[var(--kt-asphalt)] px-5 py-3 text-sm font-semibold text-white"
        >
          Return to checkout
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center border border-[var(--kt-asphalt)] px-5 py-3 text-sm font-semibold"
        >
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
