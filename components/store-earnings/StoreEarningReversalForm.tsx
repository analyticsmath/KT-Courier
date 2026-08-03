"use client";

import { useState } from "react";

export function StoreEarningReversalForm({ earningId }: { earningId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setPending(true); setMessage(null);
    const reasonCode = String(formData.get("reasonCode") ?? "");
    const safeNote = String(formData.get("safeNote") ?? "").trim();
    const response = await fetch(`/api/admin/store-earnings/${earningId}/reverse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: `store-earning-ui:${crypto.randomUUID()}`, reasonCode, ...(safeNote ? { safeNote } : {}) }) });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Canonical reversal request completed." : result.error ?? "Reversal request failed.");
    setPending(false);
  }
  return <form action={submit} className="space-y-3" aria-label="Store earning reversal"><h2 className="text-lg font-semibold">Exact remaining reversal</h2><p className="text-sm text-[var(--kt-text-muted)]">The service derives the amount and accounts from immutable earning evidence. Consolidated validation currently keeps financial execution locked.</p><label className="block text-sm font-semibold" htmlFor="store-earning-reversal-reason">Approved reason</label><select id="store-earning-reversal-reason" name="reasonCode" className="w-full rounded border p-2" defaultValue="SETTLEMENT_INVALIDATED"><option value="SETTLEMENT_INVALIDATED">Settlement invalidated</option><option value="STORE_ENTITLEMENT_CANCELLED">Store entitlement cancelled</option><option value="DUPLICATE_SETTLEMENT_CORRECTION">Duplicate settlement correction</option><option value="AUTHORITATIVE_RECALCULATION">Authoritative recalculation</option></select><label className="block text-sm font-semibold" htmlFor="store-earning-reversal-note">Safe note (optional)</label><textarea id="store-earning-reversal-note" name="safeNote" maxLength={240} className="w-full rounded border p-2" /><button type="submit" disabled={pending} className="rounded bg-slate-900 px-3 py-2 text-white">{pending ? "Submitting…" : "Request exact reversal"}</button>{message ? <p role="status" className="text-sm">{message}</p> : null}</form>;
}
