"use client";

import { useState } from "react";

export function RefundRequestForm({ disabledReason }: Readonly<{ disabledReason: string | null }>) {
  const [paymentPublicReference, setPaymentPublicReference] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CUSTOMER_WALLET");
  const [reasonCode, setReasonCode] = useState("ORDER_CANCELLED");
  const [customerNote, setCustomerNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const disabled = Boolean(disabledReason) || pending;

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setMessage(null);
    try {
      const response = await fetch("/api/refunds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentPublicReference, amount, method, reasonCode, customerNote: customerNote || undefined, operationId: crypto.randomUUID() }) });
      const payload = await response.json() as { error?: string; refund?: { publicReference: string } };
      setMessage(response.ok ? `Refund ${payload.refund?.publicReference ?? "request"} was reserved for review.` : payload.error ?? "Refund request could not be created.");
    } catch { setMessage("Refund request could not be created."); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" aria-label="Refund request form">
    <div><label htmlFor="refund-payment" className="block text-sm font-medium">Payment reference</label><input id="refund-payment" value={paymentPublicReference} onChange={(event) => setPaymentPublicReference(event.target.value)} disabled={disabled} required className="mt-1 w-full rounded border p-2" /></div>
    <div><label htmlFor="refund-amount" className="block text-sm font-medium">Exact amount (ZAR)</label><input id="refund-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={disabled} required placeholder="125.00" className="mt-1 w-full rounded border p-2" /></div>
    <div><label htmlFor="refund-method" className="block text-sm font-medium">Refund method</label><select id="refund-method" value={method} onChange={(event) => setMethod(event.target.value)} disabled={disabled} className="mt-1 w-full rounded border p-2"><option value="CUSTOMER_WALLET">Customer wallet</option><option value="ORIGINAL_PAYMENT_METHOD">Original payment method</option></select></div>
    <div><label htmlFor="refund-reason" className="block text-sm font-medium">Reason</label><select id="refund-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={disabled} className="mt-1 w-full rounded border p-2"><option value="ORDER_CANCELLED">Order cancelled</option><option value="SERVICE_NOT_PROVIDED">Service not provided</option><option value="DUPLICATE_PAYMENT">Duplicate payment</option><option value="OVERPAYMENT">Overpayment</option><option value="SERVICE_FAILURE">Service failure</option><option value="CUSTOMER_SERVICE_RESOLUTION">Customer service resolution</option><option value="OTHER_REVIEWED">Other reviewed reason</option></select></div>
    <div className="sm:col-span-2"><label htmlFor="refund-note" className="block text-sm font-medium">Optional note</label><textarea id="refund-note" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} disabled={disabled} maxLength={500} className="mt-1 w-full rounded border p-2" /><p className="mt-1 text-xs text-slate-600">Do not include card or banking information.</p></div>
    <div className="sm:col-span-2">{disabledReason ? <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{disabledReason}</p> : <button type="submit" disabled={disabled} className="rounded bg-slate-900 px-4 py-2 text-white">{pending ? "Submitting…" : "Request refund"}</button>}{message ? <p role="status" className="mt-2 text-sm">{message}</p> : null}</div>
  </form>;
}

