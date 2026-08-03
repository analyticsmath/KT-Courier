"use client";
import { useState } from "react";

function operationId() { return crypto.randomUUID(); }

export function StoreOrderActionPanel({ reference, acceptanceStatus, preparationStatus }: Readonly<{ reference: string; acceptanceStatus: string; preparationStatus: string }>) {
  const [message, setMessage] = useState<string | null>(null);
  async function run(action: string, fields: Record<string, unknown> = {}) {
    setMessage(null); const response = await fetch(`/api/store/orders/${encodeURIComponent(reference)}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, operationId: operationId(), ...fields }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? "Action recorded. Refresh to see the authoritative status." : body.error ?? "Action could not be completed.");
  }
  return <section className="rounded-2xl border border-[var(--kt-soft-border)] bg-white p-4" aria-labelledby="store-order-actions">
    <h2 id="store-order-actions" className="text-sm font-extrabold text-[var(--kt-ink-navy)]">Stage actions</h2>
    <p className="mt-1 text-xs text-[var(--kt-text-muted)]">Actions are stage-specific. This screen cannot assign drivers or mark customer delivery complete.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {acceptanceStatus === "PENDING_STORE_REVIEW" && <button className="rounded-lg bg-[var(--kt-signal-cobalt)] px-3 py-2 text-sm font-bold text-white" onClick={() => run("begin-review")}>Begin review</button>}
      {["PENDING_STORE_REVIEW", "REVIEWING"].includes(acceptanceStatus) && <button className="rounded-lg bg-[var(--kt-teal-emerald)] px-3 py-2 text-sm font-bold text-white" onClick={() => run("accept", { preparationMinutes: 30, pickupInstructions: "Use the confirmed store pickup point." })}>Accept when lines are clear</button>}
      {acceptanceStatus === "ACCEPTED" && preparationStatus === "NOT_STARTED" && <button className="rounded-lg bg-[var(--kt-ink-navy)] px-3 py-2 text-sm font-bold text-white" onClick={() => run("start-preparation")}>Start preparation</button>}
      {preparationStatus === "PREPARING" && <button className="rounded-lg border border-[var(--kt-signal-cobalt)] px-3 py-2 text-sm font-bold text-[var(--kt-signal-cobalt)]" onClick={() => run("mark-ready")}>Mark ready for handoff</button>}
    </div>
    <p className="mt-4 text-xs font-semibold text-[var(--kt-text-muted)]">Reject only for a structured reason</p>
    <button className="mt-2 rounded-lg border border-[var(--kt-signal-red)] px-3 py-2 text-sm font-bold text-[var(--kt-signal-red)]" onClick={() => run("reject", { reasonCode: "STORE_CAPACITY_UNAVAILABLE", note: "" })}>Reject: capacity unavailable</button>
    {message && <p className="mt-3 text-sm" role="status" aria-live="polite">{message}</p>}
  </section>;
}
