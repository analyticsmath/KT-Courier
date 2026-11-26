"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicTrackingStatusProjection } from "@/lib/shipment-documents/contracts";
import { GENERIC_TRACKING_LINK_ERROR } from "@/lib/tracking/recipient-access-copy";

interface TrackingShareClientProps {
  initialProjection: PublicTrackingStatusProjection | null;
  expectedGrantRef: string | null;
}

const TONE_CLASSES: Record<PublicTrackingStatusProjection["statusTone"], string> = {
  neutral: "bg-slate-100 text-slate-800 border-slate-300",
  information: "bg-blue-50 text-blue-900 border-blue-200",
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  danger: "bg-red-50 text-red-900 border-red-200",
};

function readTokenFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const token = hashParams.get("token")?.trim();
    if (token) return token;
  }
  const searchParams = new URLSearchParams(window.location.search);
  const queryToken = searchParams.get("token")?.trim();
  return queryToken || null;
}

export function TrackingShareClient({
  initialProjection,
  expectedGrantRef,
}: TrackingShareClientProps) {
  const router = useRouter();
  const attemptedExchange = useRef(false);
  const [exchangedProjection, setExchangedProjection] = useState<
    PublicTrackingStatusProjection | null | undefined
  >(undefined);
  const [exchanging, setExchanging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const projection = exchangedProjection !== undefined ? exchangedProjection : initialProjection;

  useEffect(() => {
    if (attemptedExchange.current) return;
    const rawToken = readTokenFromWindow();
    if (!rawToken) return;

    attemptedExchange.current = true;
    let cancelled = false;

    // Strip raw share secret from browser URL immediately so it never remains in
    // browser history, screenshots, or Referer headers.
    if (typeof window !== "undefined") {
      const cleanUrl = expectedGrantRef
        ? `/track/share?g=${encodeURIComponent(expectedGrantRef)}`
        : "/track/share";
      window.history.replaceState(null, "", cleanUrl);
    }

    Promise.resolve()
      .then(async () => {
        if (cancelled) return;
        setExchanging(true);
        setErrorMessage(null);
        const res = await fetch("/api/track/share/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawToken }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          redirectPath?: string;
          tracking?: PublicTrackingStatusProjection;
          error?: string;
        } | null;

        if (cancelled) return;
        if (!res.ok || !data?.ok || !data.tracking) {
          setExchangedProjection(null);
          setErrorMessage(data?.error ?? GENERIC_TRACKING_LINK_ERROR);
          return;
        }

        setExchangedProjection(data.tracking);
        if (data.redirectPath && typeof window !== "undefined") {
          window.history.replaceState(null, "", data.redirectPath);
        }
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(GENERIC_TRACKING_LINK_ERROR);
      })
      .finally(() => {
        if (!cancelled) setExchanging(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expectedGrantRef, router]);

  async function handleClearSession() {
    if (clearing) return;
    setClearing(true);
    try {
      await fetch("/api/track/share/exchange", { method: "DELETE" });
      setExchangedProjection(null);
      setErrorMessage("Shared tracking session cleared on this browser.");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/track/share");
      }
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  if (exchanging) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">
          Verifying tracking access
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Loading consignment status…</h1>
        <p className="mt-2 text-sm text-slate-600">
          Exchanging your recipient tracking link for a scoped status view.
        </p>
      </div>
    );
  }

  if (!projection) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recipient status tracking
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Tracking link unavailable</h1>
        </div>
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          {errorMessage ?? GENERIC_TRACKING_LINK_ERROR}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/track"
            className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to parcel tracking
          </Link>
          <Link
            href="/login?returnUrl=/account/orders"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Sign in to KT Couriers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">
              KT Couriers · Shared Status View
            </p>
            <h1 className="mt-1 font-mono text-2xl md:text-3xl font-bold text-slate-950">
              {projection.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {projection.deliveryTypeLabel} · {projection.parcelCount} parcel
              {projection.parcelCount === 1 ? "" : "s"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-bold ${TONE_CLASSES[projection.statusTone]}`}
          >
            {projection.statusLabel}
          </span>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Collection area
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{projection.pickupArea}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Destination area
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{projection.dropoffArea}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booked
            </dt>
            <dd className="mt-1 text-sm text-slate-800">{projection.createdAtSast}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {projection.deliveredAtSast ? "Delivered" : projection.scheduledForSast ? "Scheduled date" : "Link expires"}
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {projection.deliveredAtSast ?? projection.scheduledForSast ?? projection.expiresAtSast}
            </dd>
          </div>
        </dl>

        <div className="mt-7">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Delivery milestones
          </h2>
          <ol className="mt-4 space-y-4">
            {projection.milestones.map((milestone) => {
              const dotClass =
                milestone.state === "COMPLETED"
                  ? "bg-emerald-600 ring-4 ring-emerald-100"
                  : milestone.state === "CURRENT"
                    ? "bg-blue-700 ring-4 ring-blue-100"
                    : milestone.state === "EXCEPTION"
                      ? "bg-amber-600 ring-4 ring-amber-100"
                      : "bg-slate-300";

              return (
                <li key={milestone.key} className="flex gap-3.5">
                  <div className="pt-1.5">
                    <span className={`block h-2.5 w-2.5 rounded-full ${dotClass}`} />
                  </div>
                  <div className="flex-1 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{milestone.label}</p>
                      {milestone.occurredAtSast && (
                        <time className="text-xs font-mono text-slate-500">
                          {milestone.occurredAtSast}
                        </time>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{milestone.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          For privacy protection, shared tracking links display milestone progress and general areas only. Exact addresses, live GPS coordinates, financial amounts, verification OTPs, and downloadable documents are available exclusively to signed-in shipment owners in their KT Couriers account.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          {projection.issuer ? (
            <p className="text-xs text-slate-600">
              {projection.issuer.tradingName} · Support:{" "}
              <a className="underline" href={`mailto:${projection.issuer.supportEmail}`}>
                {projection.issuer.supportEmail}
              </a>
              {projection.issuer.primaryPhone ? ` · ${projection.issuer.primaryPhone}` : ""}
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearing}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {clearing ? "Clearing…" : "Clear tracking session"}
            </button>
            <Link
              href="/login?returnUrl=/account/orders"
              className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Account holder sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
