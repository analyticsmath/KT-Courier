"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Evidence = { reference: string; label: string };
export function CodDeliveryExceptionAction({ orderId, mode, evidence }: { orderId: string; mode: "report" | "review"; evidence: Evidence[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<{ payload: string; operationId: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = mode === "report"
      ? { action: "REPORT", reason: fields.get("reason"), evidenceReference: fields.get("evidenceReference") }
      : { action: "REVIEW", reason: fields.get("reason"), decision: fields.get("decision") };
    const payload = JSON.stringify(body);
    if (!pending.current || pending.current.payload !== payload) pending.current = { payload, operationId: crypto.randomUUID() };
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/cod-delivery-exception`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, operationId: pending.current.operationId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error ?? "The request could not be saved."); return; }
      pending.current = null; form.reset();
      setMessage(mode === "report" ? "Report recorded for independent review." : "Review recorded.");
      router.refresh();
    } catch { setMessage("The result is unknown. Retry the same request safely."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3">
    <p className="text-sm">{mode === "report" ? "Report a physical delivery for independent review. This does not record cash or complete the financial settlement." : "Review the private evidence independently. This does not record cash or settle the order."}</p>
    {mode === "report" ? <div><label htmlFor="cod-exception-evidence" className="block text-sm font-semibold">Private delivery evidence</label><select id="cod-exception-evidence" name="evidenceReference" required defaultValue="" className="mt-1 w-full rounded border border-[var(--kt-soft-border)] p-2"><option value="" disabled>Select evidence</option>{evidence.map(item => <option key={item.reference} value={item.reference}>{item.label} ({item.reference})</option>)}</select>{!evidence.length ? <p className="text-sm">Validated private delivery evidence must be available before a report can be submitted.</p> : null}</div> : <div><label htmlFor="cod-exception-decision" className="block text-sm font-semibold">Review decision</label><select id="cod-exception-decision" name="decision" required defaultValue="" className="mt-1 w-full rounded border border-[var(--kt-soft-border)] p-2"><option value="" disabled>Select a decision</option><option value="VERIFY">Verify reported delivery</option><option value="REJECT">Reject report</option></select></div>}
    <div><label htmlFor="cod-exception-reason" className="block text-sm font-semibold">Reason</label><textarea id="cod-exception-reason" name="reason" required maxLength={1000} className="mt-1 w-full rounded border border-[var(--kt-soft-border)] p-2" /></div>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    <button type="submit" disabled={busy || (mode === "report" && !evidence.length)} className="eo-inline-action">{busy ? "Saving…" : mode === "report" ? "Report delivery for review" : "Record independent review"}</button>
  </form>;
}
