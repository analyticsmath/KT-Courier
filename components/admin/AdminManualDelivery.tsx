"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminManualDelivery({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/proof-of-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: fields.get("recipientName"), reason: fields.get("reason") }),
      });
      const result = await response.json() as { error?: string; code?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Delivery could not be confirmed. Please try again.");
        return;
      }
      form.reset();
      setSuccess(true);
      router.refresh();
    } catch {
      setMessage("Delivery could not be confirmed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-4 space-y-3">
    <p className="text-sm">Use this only to record a verified physical delivery when the normal proof process is unavailable. Cash collection must be recorded before a cash-on-delivery order can be completed.</p>
    <div><label htmlFor="manual-recipient" className="block text-sm font-semibold">Recipient name</label><input id="manual-recipient" name="recipientName" required maxLength={150} className="mt-1 w-full rounded border border-[var(--kt-soft-border)] p-2" /></div>
    <div><label htmlFor="manual-reason" className="block text-sm font-semibold">Reason for manual confirmation</label><textarea id="manual-reason" name="reason" required maxLength={1000} className="mt-1 w-full rounded border border-[var(--kt-soft-border)] p-2" /></div>
    {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
    {success ? <p role="status" className="text-sm">Delivery confirmed.</p> : null}
    <button type="submit" disabled={busy} className="eo-inline-action">{busy ? "Confirming…" : "Confirm manual delivery"}</button>
  </form>;
}
