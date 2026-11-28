"use client";

import { useState } from "react";
import type { QaSettlementRecoveryRecord } from "@/lib/qa-acceptance/settlement-recovery";

interface QaOrderRecoveryRow {
  orderId: string;
  orderNumber: string;
  totalAmountZar: string;
  diagnostic: {
    settled: boolean;
    blockerCode: string | null;
    blockerMessage: string | null;
    completedAt: string | null;
  } | null;
  recovery: QaSettlementRecoveryRecord | null;
}

interface CourierPlanSummary {
  publicReference: string;
  scopeKey: string;
  versionNumber: number;
}

export function QaSettlementRecoveryPanel({
  initialItems,
  initialPlans,
  canManage,
  canApprove,
}: {
  initialItems: readonly QaOrderRecoveryRow[];
  initialPlans: readonly CourierPlanSummary[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [plans, setPlans] = useState(initialPlans);
  const [selectedPlanByOrder, setSelectedPlanByOrder] = useState<Record<string, string>>({});
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/qa-acceptance/settlement-recovery", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const body = (await res.json()) as {
      items?: QaOrderRecoveryRow[];
      plans?: CourierPlanSummary[];
      error?: string;
    };
    if (!res.ok) throw new Error(body.error ?? "Failed to reload QA settlement recovery list.");
    if (body.items) setItems(body.items);
    if (body.plans) setPlans(body.plans);
  }

  async function handlePrepare(orderId: string) {
    const planPublicReference =
      selectedPlanByOrder[orderId] ?? plans[0]?.publicReference ?? "";
    const reason =
      reasonByOrder[orderId]?.trim() ||
      "Dual-control QA historical settlement recovery against approved courier commission plan without altering historical timestamps.";
    if (!planPublicReference) {
      setError("Create and activate a GLOBAL:COURIER_ORDER or QA:COURIER_ORDER commission plan first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/qa-acceptance/settlement-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId, planPublicReference, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare QA recovery.");
      setNotice("QA historical settlement recovery prepared. A different authorized administrator must independently approve it.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare QA recovery.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(
    orderId: string,
    expectedVersion: number,
    action: "APPROVE" | "REVOKE",
  ) {
    const reason =
      reasonByOrder[orderId]?.trim() ||
      (action === "APPROVE"
        ? "Independent finance/admin review verified isolated QA delivery and authorized historical settlement recovery."
        : "Revoked QA settlement recovery draft pending updated commission review.");
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/qa-acceptance/settlement-recovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          orderId,
          expectedVersion,
          reason,
          settleImmediately: action === "APPROVE",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        settlement?: { publicReference: string; commissionReference?: string } | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Review action failed.");
      setNotice(
        action === "APPROVE"
          ? `Approved & settled QA earning ${data.settlement?.publicReference ?? ""} (isolated ledger only).`
          : "QA settlement recovery revoked.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review action failed.");
    } finally {
      setBusy(false);
    }
  }

  const actionable = items.filter((item) => !item.diagnostic?.settled);

  return (
    <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--kt-brand-navy)]">
            QA-Only Historical Courier Settlement Recovery (Isolated)
          </h2>
          <p className="text-xs text-[var(--kt-text-muted)]">
            Strictly limited to delivered <code className="font-mono">isQaAcceptance=true</code> courier orders whose deliveries completed prior to an active courier commission plan. Never mutates historical approval or completion timestamps and never applies to commercial orders.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
        >
          Refresh QA Orders
        </button>
      </div>

      {(notice || error) && (
        <p role="status" className={`text-xs font-semibold ${error ? "text-rose-700" : "text-emerald-800"}`}>
          {error ?? notice}
        </p>
      )}

      {actionable.length === 0 ? (
        <p className="text-xs text-[var(--kt-text-soft)]">
          All delivered QA courier orders currently have settled isolated driver earnings.
        </p>
      ) : (
        <ul className="space-y-3">
          {actionable.map((item) => (
            <li key={item.orderId} className="rounded-lg border bg-white p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {item.orderNumber} · R {item.totalAmountZar}
                  {item.diagnostic?.completedAt ? ` · delivered ${new Date(item.diagnostic.completedAt).toISOString()}` : ""}
                </span>
                <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                  {item.recovery?.status ?? item.diagnostic?.blockerCode ?? "BLOCKED"}
                </span>
              </div>
              {item.diagnostic?.blockerMessage ? (
                <p className="text-[var(--kt-text-soft)]">{item.diagnostic.blockerMessage}</p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  aria-label={`Plan for ${item.orderNumber}`}
                  value={selectedPlanByOrder[item.orderId] ?? plans[0]?.publicReference ?? ""}
                  onChange={(e) =>
                    setSelectedPlanByOrder((prev) => ({ ...prev, [item.orderId]: e.target.value }))
                  }
                  className="rounded border px-2 py-1.5"
                >
                  {plans.length === 0 ? (
                    <option value="">No active GLOBAL/QA COURIER_ORDER plan</option>
                  ) : (
                    plans.map((p) => (
                      <option key={p.publicReference} value={p.publicReference}>
                        {p.publicReference} ({p.scopeKey} v{p.versionNumber})
                      </option>
                    ))
                  )}
                </select>
                <input
                  value={reasonByOrder[item.orderId] ?? ""}
                  onChange={(e) =>
                    setReasonByOrder((prev) => ({ ...prev, [item.orderId]: e.target.value }))
                  }
                  placeholder="Dual-control audit reason (min 10 chars)"
                  className="rounded border px-2 py-1.5 sm:col-span-2"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage && (!item.recovery || item.recovery.status === "REVOKED") ? (
                  <button
                    type="button"
                    disabled={busy || plans.length === 0}
                    onClick={() => void handlePrepare(item.orderId)}
                    className="rounded bg-slate-900 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                  >
                    Prepare QA Recovery
                  </button>
                ) : null}
                {canApprove && item.recovery?.status === "PENDING_REVIEW" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleReview(item.orderId, item.recovery!.version, "APPROVE")
                      }
                      className="rounded bg-emerald-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                    >
                      Independently Approve &amp; Settle QA Earning
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleReview(item.orderId, item.recovery!.version, "REVOKE")
                      }
                      className="rounded border px-3 py-1.5 font-semibold disabled:opacity-50"
                    >
                      Revoke Draft
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
