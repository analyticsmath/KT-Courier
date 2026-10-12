"use client";

import { useRef, useState } from "react";

type Destination = Readonly<{ publicReference: string; maskedLabel: string; institutionName: string | null; accountLast4: string | null }>;

export function WithdrawalRequestForm({ destinations, disabledReason }: Readonly<{ destinations: readonly Destination[]; disabledReason: string | null }>) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState(destinations[0]?.publicReference ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const operation = useRef<{ payload: string; id: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setSubmitting(true); setMessage(null);
    try {
      const payloadIdentity = JSON.stringify([amount, destination]);
      if (operation.current?.payload !== payloadIdentity) operation.current = { payload: payloadIdentity, id: crypto.randomUUID() };
      const response = await fetch("/api/withdrawals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, payoutDestinationPublicReference: destination, operationId: operation.current.id }) });
      const payload = await response.json() as { error?: string; withdrawal?: { publicReference: string } };
      setMessage(response.ok ? `Withdrawal request ${payload.withdrawal?.publicReference ?? "created"}.` : payload.error ?? "Withdrawal request could not be created.");
    } catch { setMessage("Withdrawal request could not be submitted. Please try again."); }
    finally { inFlight.current = false; setSubmitting(false); }
  }

  if (disabledReason) return <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{disabledReason}</p>;
  return <form onSubmit={submit} className="space-y-4" aria-label="Request withdrawal">
    <div><label htmlFor="withdrawal-amount" className="block text-sm font-medium">Amount (ZAR)</label><input id="withdrawal-amount" name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required pattern="^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$" className="mt-1 w-full rounded border p-2" /></div>
    <div><label htmlFor="withdrawal-destination" className="block text-sm font-medium">Payout destination</label><select id="withdrawal-destination" name="payoutDestination" value={destination} onChange={(event) => setDestination(event.target.value)} required className="mt-1 w-full rounded border p-2">{destinations.map((item) => <option key={item.publicReference} value={item.publicReference}>{item.maskedLabel}{item.accountLast4 && !item.maskedLabel.includes(item.accountLast4) ? ` •••• ${item.accountLast4}` : ""}</option>)}</select></div>
    <p className="text-xs text-slate-600">Payout destinations are masked external references. This form never collects bank-account numbers.</p>
    <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{submitting ? "Submitting…" : "Request withdrawal"}</button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </form>;
}
