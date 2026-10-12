"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "APPROVE_TEMPLATE" | "PUBLISH_TEMPLATE" | "APPROVE_RECIPIENT_POLICY" | "PREPARE_ROUTE" | "APPROVE_ROUTE" | "ACTIVATE_ROUTE";
export type CustomerOrderReviewRow = { eventType: string; label: string; recipientSummary: string; title: string; body: string; templateStatus: string; recipientPolicyStatus: string; routeStatus: string; activatedAt: string | null; actions: { action: Action; label: string }[]; publisherMustDiffer: boolean; activatorMustDiffer: boolean };

export function CustomerOrderNotificationReview({ rows, locked }: { rows: CustomerOrderReviewRow[]; locked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function act(eventType: string, action: Action) {
    setBusy(`${eventType}:${action}`); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/notifications/customer-orders/${eventType}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The review action could not be completed.");
      setMessage(`Saved: ${String(result.data.status).replaceAll("_", " ").toLowerCase()}.`);
      startTransition(() => router.refresh());
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The review action could not be completed."); }
    finally { setBusy(null); }
  }
  return <div className="space-y-6">
    {locked && <p role="status">Notification publication is locked pending provider validation.</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <p role="status" aria-live="polite">{message}</p>
    {rows.map((row) => <section key={row.eventType} aria-label={row.label} className="rounded-xl border border-[var(--eo-border)] p-5 space-y-4">
      <h2 className="text-xl font-semibold">{row.label}</h2>
      <div><p className="font-medium">{row.title || "Template not prepared"}</p><p className="whitespace-pre-wrap">{row.body}</p></div>
      <p>Template: {row.templateStatus.replaceAll("_", " ")} · Recipient policy: {row.recipientPolicyStatus} · Route: {row.routeStatus}</p>
      <p className="text-sm">Recipient: {row.recipientSummary} Channels: account inbox where available and verified email. Email preferences and quiet hours apply.</p>
      {row.activatedAt && <p className="text-sm">New events are eligible from {new Date(row.activatedAt).toLocaleString("en-ZA")}.</p>}
      {row.publisherMustDiffer && <p>A different administrator must publish this approved template.</p>}
      {row.activatorMustDiffer && <p>A different administrator must activate this approved route.</p>}
      <div className="flex flex-wrap gap-3">{row.actions.map(({ action, label }) => <button key={action} type="button" disabled={locked || Boolean(busy) || refreshing} onClick={() => act(row.eventType, action)} className="rounded-lg border border-[var(--eo-border)] px-4 py-2 disabled:opacity-50">{busy === `${row.eventType}:${action}` ? "Saving…" : label}</button>)}</div>
    </section>)}
  </div>;
}
