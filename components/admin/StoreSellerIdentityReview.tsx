"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
export function StoreSellerIdentityReview({ storeId, proposalReference, updatedAt }: { storeId: string; proposalReference: string; updatedAt: string }) {
  const router = useRouter(), pending = useRef(false), command = useRef<{ signature: string; body: Record<string, unknown> } | null>(null);
  const [reason, setReason] = useState(""), [evidence, setEvidence] = useState(""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  async function act(action: "APPROVE" | "REJECT") {
    if (pending.current) return; pending.current = true; setBusy(true); setError(""); setStatus("");
    const fields = { proposalReference, expectedUpdatedAt: updatedAt, action, reason: reason.trim(), evidenceReference: evidence.trim(), confirmIndependentReview: confirmed }, signature = JSON.stringify(fields);
    if (command.current?.signature !== signature) command.current = { signature, body: { ...fields, operationId: crypto.randomUUID() } };
    try {
      const response = await fetch(`/api/admin/stores/${storeId}/seller-identity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command.current.body) }); const reply = await response.json();
      if (!response.ok) { setError(reply.error ?? "Seller review could not be recorded."); return; }
      setStatus(reply.proposal.status === "APPROVED" ? "Seller identity approved for its effective window." : "Seller identity proposal rejected."); router.refresh();
    } catch { setError("Review could not be confirmed. Retry the same decision to check this request."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Independent seller identity review" className="space-y-3">
    <label>Seller review reason<Input value={reason} onChange={event => setReason(event.target.value)} maxLength={240} /></label>
    <label>Reviewed evidence reference<Input value={evidence} onChange={event => setEvidence(event.target.value)} maxLength={240} /></label>
    <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I have independently reviewed the supplied seller details and evidence.</label>
    {error ? <p role="alert">{error}</p> : null}<p role="status" aria-live="polite">{status}</p>
    <div className="flex flex-wrap gap-3"><Button disabled={busy || !confirmed || reason.trim().length < 8 || evidence.trim().length < 8} onClick={() => void act("APPROVE")}>Approve seller identity</Button><Button variant="secondary" disabled={busy || !confirmed || reason.trim().length < 8 || evidence.trim().length < 8} onClick={() => void act("REJECT")}>Reject seller identity</Button></div>
  </section>;
}
