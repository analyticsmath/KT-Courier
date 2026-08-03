"use client";

import { useState } from "react";

export function FinanceRefundActions({ id, status, method, canReview, canApprove, canProcess, canReconcile, completionLocked }: Readonly<{ id: string; status: string; method: string; canReview: boolean; canApprove: boolean; canProcess: boolean; canReconcile: boolean; completionLocked: boolean }>) {
  const [message, setMessage] = useState<string | null>(null); const [pending, setPending] = useState(false);
  async function post(path: string, body: Record<string, string> = {}) { setPending(true); setMessage(null); try { const response = await fetch(`/api/admin/refunds/${id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), ...body }) }); const payload = await response.json() as { error?: string }; setMessage(response.ok ? "Action recorded. Refresh to inspect the immutable evidence." : payload.error ?? "Refund action could not be recorded."); } catch { setMessage("Refund action could not be recorded."); } finally { setPending(false); } }
  return <section aria-label="Finance refund actions" className="space-y-3"><h2 className="text-lg font-semibold">Finance actions</h2>
    {status === "REQUESTED" && canReview ? <button disabled={pending} onClick={() => post("review")} className="rounded border px-3 py-2">Start review</button> : null}
    {(status === "REQUESTED" || status === "UNDER_REVIEW") ? <>{canApprove ? <button disabled={pending} onClick={() => post("approve")} className="ml-2 rounded border px-3 py-2">Approve</button> : null}{canReview ? <button disabled={pending} onClick={() => post("reject", { financeNote: "Finance review rejected the refund request." })} className="ml-2 rounded border px-3 py-2">Reject and release</button> : null}</> : null}
    {status === "APPROVED" && canProcess ? completionLocked ? <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Refund completion is inactive pending consolidated validation approval.</p> : method === "CUSTOMER_WALLET" ? <button disabled={pending} onClick={() => post("complete-wallet")} className="rounded border px-3 py-2">Complete wallet credit</button> : <button disabled={pending} onClick={() => post("start-provider-refund")} className="rounded border px-3 py-2">Start provider refund</button> : null}
    {status === "RECONCILIATION_REQUIRED" && canReconcile ? completionLocked ? <p role="status" className="text-sm text-amber-900">Provider status queries remain validation-locked.</p> : <button disabled={pending} onClick={() => post("query-provider-status")} className="rounded border px-3 py-2">Query provider status</button> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>;
}

