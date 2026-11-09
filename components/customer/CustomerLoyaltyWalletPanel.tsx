"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LoyaltySummary = Readonly<{
  availablePoints: string;
  debtPoints: string;
  lifetimeEarnedPoints: string;
  conversion: Readonly<{
    enabled: boolean;
    pointsRequired: number;
    walletRand: string;
  }>;
  redemptions: readonly Readonly<{
    reference: string;
    pointsRedeemed: string;
    walletCreditZar: string;
    occurredAt: string;
  }>[];
}>;

function validPoints(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d*)$/.test(value) || value.length > 19) return null;
  const parsed = BigInt(value);
  return parsed <= 9223372036854775807n ? parsed : null;
}

function safeSummary(value: unknown): LoyaltySummary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.availablePoints !== "string" || validPoints(data.availablePoints) === null ||
      typeof data.debtPoints !== "string" || validPoints(data.debtPoints) === null ||
      typeof data.lifetimeEarnedPoints !== "string" || validPoints(data.lifetimeEarnedPoints) === null ||
      !data.conversion || typeof data.conversion !== "object") return null;
  const conversion = data.conversion as Record<string, unknown>;
  if (typeof conversion.enabled !== "boolean" ||
      typeof conversion.pointsRequired !== "number" ||
      !Number.isSafeInteger(conversion.pointsRequired) || conversion.pointsRequired <= 0 ||
      typeof conversion.walletRand !== "string" ||
      !/^(?:0|[1-9]\d*)\.\d{2}$/.test(conversion.walletRand)) return null;
  const redemptions = Array.isArray(data.redemptions)
    ? data.redemptions.filter((entry: unknown) => {
        if (!entry || typeof entry !== "object") return false;
        const item = entry as Record<string, unknown>;
        return typeof item.reference === "string" && typeof item.pointsRedeemed === "string" &&
          typeof item.walletCreditZar === "string" && typeof item.occurredAt === "string";
      }).slice(0, 5)
    : [];
  return { availablePoints: data.availablePoints, debtPoints: data.debtPoints,
    lifetimeEarnedPoints: data.lifetimeEarnedPoints,
    conversion: { enabled: conversion.enabled, pointsRequired: conversion.pointsRequired,
      walletRand: conversion.walletRand }, redemptions: redemptions as LoyaltySummary["redemptions"] };
}

async function fetchLoyalty(signal?: AbortSignal): Promise<LoyaltySummary> {
  const response = await fetch("/api/account/loyalty", { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error("Your loyalty balance cannot be read right now.");
  const result = safeSummary(await response.json());
  if (!result) throw new Error("Your loyalty balance is temporarily unavailable.");
  return result;
}

/** Customer-only interface; money authority stays inside the API/database.
 * A failed network request retains the same operation ID for a safe retry.
 */
export function CustomerLoyaltyWalletPanel() {
  const router = useRouter();
  const operation = useRef<string | null>(null);
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const next = await fetchLoyalty(signal);
    setSummary(next);
    return next;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLoyalty(controller.signal)
      .then(next => { if (!controller.signal.aborted) setSummary(next); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Your loyalty balance is temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function redeem() {
    if (submitting || !summary?.conversion.enabled) return;
    const required = BigInt(summary.conversion.pointsRequired);
    const available = validPoints(summary.availablePoints);
    const debt = validPoints(summary.debtPoints);
    if (required <= 0n || available === null || available < required || debt !== 0n) return;
    setError("");
    setConfirmation("");
    setSubmitting(true);
    const operationId = operation.current ?? crypto.randomUUID();
    operation.current = operationId;
    try {
      const response = await fetch("/api/account/loyalty/redeem", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId, points: summary.conversion.pointsRequired.toString() }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result
          && typeof (result as { error: unknown }).error === "string"
          ? (result as { error: string }).error
          : "The conversion could not be completed. You can retry safely.";
        throw new Error(message);
      }
      if (!result || typeof result !== "object" || !("journalId" in result) ||
          typeof (result as { journalId: unknown }).journalId !== "string") {
        throw new Error("Your conversion needs confirmation. Retry using the same transaction.");
      }
      const receipt = result as { walletCreditZar?: string; pointsRedeemed?: string };
      operation.current = null;
      setConfirmation(`${receipt.pointsRedeemed ?? summary.conversion.pointsRequired} points were converted into R${receipt.walletCreditZar ?? summary.conversion.walletRand} wallet credit.`);
      await refresh();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to confirm conversion.");
    } finally {
      setSubmitting(false);
    }
  }

  const required = summary ? BigInt(summary.conversion.pointsRequired) : 0n;
  const balance = summary ? validPoints(summary.availablePoints) : null;
  const debt = summary ? validPoints(summary.debtPoints) : null;
  const canRedeem = summary?.conversion.enabled && debt === 0n && balance !== null &&
    required > 0n && balance >= required;

  return (
    <section aria-labelledby="customer-loyalty-title" className="rounded-2xl border border-[var(--eo-border)] bg-[var(--eo-surface)] p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--eo-text-secondary)]">Customer rewards</p>
          <h2 id="customer-loyalty-title" className="mt-1 text-lg font-semibold text-[var(--eo-text)]">Loyalty points</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--eo-text-secondary)]">
            Points are based on verified, completed eligible orders. Wallet credits are not cash withdrawals.
          </p>
        </div>
        {summary && <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-[var(--eo-text)]">{summary.availablePoints}</p>
          <p className="text-xs text-[var(--eo-text-secondary)]">Available points</p>
        </div>}
      </div>
      {loading && <p role="status" className="text-sm text-[var(--eo-text-secondary)]">Loading loyalty account…</p>}
      {!loading && !summary && (
        <button type="button" onClick={() => {
          setLoading(true); setError("");
          void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Loyalty is unavailable."))
            .finally(() => setLoading(false));
        }} className="rounded-lg border border-[var(--eo-border)] px-4 py-2 text-sm font-semibold">
          Retry loyalty balance
        </button>
      )}
      {summary && <>
        {debt !== null && debt > 0n && (
          <p className="mb-3 text-sm text-[var(--eo-text-secondary)]">
            Reversed rewards awaiting recovery: {summary.debtPoints} points. Conversions are paused until this is cleared.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void redeem()}
            disabled={!canRedeem || submitting}
            aria-describedby="loyalty-conversion-policy"
            className="min-h-11 rounded-lg bg-[var(--eo-surface-dark)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Confirming conversion…" : `Convert ${summary.conversion.pointsRequired} points to R${summary.conversion.walletRand}`}
          </button>
          <p id="loyalty-conversion-policy" className="text-sm text-[var(--eo-text-secondary)]">
            {!summary.conversion.enabled ? "Conversions are not currently available." :
              !canRedeem ? "Earn more eligible points to convert." : "Credits are added to your KT Couriers customer wallet."}
          </p>
        </div>
        {summary.redemptions.length > 0 && <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-[var(--eo-text)]">Recent conversions</h3>
          <ul className="divide-y divide-[var(--eo-border)]">
            {summary.redemptions.map(entry => <li key={entry.reference} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="text-[var(--eo-text-secondary)]">{entry.pointsRedeemed} points · {new Date(entry.occurredAt).toLocaleDateString("en-ZA")}</span>
              <span className="font-semibold tabular-nums text-[var(--eo-text)]">+R{entry.walletCreditZar}</span>
            </li>)}
          </ul>
        </div>}
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {confirmation && <p role="status" aria-live="polite" className="mt-4 text-sm font-semibold text-[var(--eo-text)]">{confirmation}</p>}
    </section>
  );
}
