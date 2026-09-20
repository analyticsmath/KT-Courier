"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const TERMINAL = new Set(["COMPLETED", "CANCELLED", "EXPIRED", "RECONCILIATION_REQUIRED"]);

function statusCopy(status: string, cancelled: boolean, timedOut: boolean): { title: string; body: string } {
  if (cancelled) {
    return {
      title: "Payment not completed",
      body: "You can return to checkout to review your order and try again when you’re ready.",
    };
  }
  if (status === "COMPLETED") {
    return {
      title: "Payment confirmed",
      body: "Your payment is confirmed and your order is ready for fulfilment.",
    };
  }
  if (status === "RECONCILIATION_REQUIRED") {
    return {
      title: "Payment received — order review in progress",
      body: "Your payment is recorded and the order needs a little more time before fulfilment can continue.",
    };
  }
  return {
    title: "We are confirming your payment",
    body: timedOut ? "Confirmation is taking longer than expected. Please check again shortly or return to checkout for the latest status." : "This can take a moment. We’ll update this page as soon as your payment status is ready.",
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
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (cancelled || TERMINAL.has(status)) return;

    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 24) {
        window.clearInterval(timer);
        setTimedOut(true);
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

  const copy = useMemo(() => statusCopy(status, cancelled, timedOut), [status, cancelled, timedOut]);

  return (
    <section className="mx-auto max-w-2xl px-6 pb-20 pt-28">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--kt-brand-blue)]">
        Payment status
      </p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{copy.title}</h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-[var(--kt-graphite)]">{copy.body}</p>

      <div className="mt-8 border border-[var(--kt-concrete)] bg-white p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">Checkout reference</p>
        <p className="mt-1 font-mono text-sm">{checkoutReference}</p>
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
