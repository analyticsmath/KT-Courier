"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";
import type { CustomerStoreOrderActions } from "@/lib/services/customer-store-order-actions.service";

export function CustomerStoreOrderControls({ marketplaceOrderReference, data }: { marketplaceOrderReference: string; data: CustomerStoreOrderActions }) {
  const router = useRouter(), busy = useRef(false), operations = useRef(createDriverOperationIdStore());
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  async function act(action: string, fields: Record<string, unknown>) {
    if (busy.current) return; busy.current = true; setSaving(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(`/api/marketplace-orders/${encodeURIComponent(marketplaceOrderReference)}/store-orders/${encodeURIComponent(data.storeOrderReference)}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, operationId: operations.current.get(action, fields), ...fields }) });
      const body = await response.json();
      if (!response.ok) { setFailed(true); setMessage(body.error ?? "The order could not be updated. Refresh and try again."); return; }
      operations.current.clear(action); setMessage("Your order decision was saved."); router.refresh();
    } catch { setFailed(true); setMessage("The connection was interrupted. Retry the same decision after reconnecting."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <section className="mt-4 space-y-4" aria-label={`Order decisions for ${data.storeOrderReference}`}>
    <dl className="text-sm"><dt className="font-bold">Refund progress</dt><dd>{data.financialStatus.replaceAll("_", " ").toLocaleLowerCase("en-ZA").replace(/^\p{L}/u, letter => letter.toLocaleUpperCase("en-ZA"))}</dd></dl>
    {data.lines.filter(line => line.canChange).map(line => <form key={line.id} className="space-y-2" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget), preference = String(values.get("preference")); const choices = values.getAll("replacementChoice").map(reference => data.replacements.find(item => item.offerReference === reference)).filter(item => item !== undefined).map(item => ({ offerReference: item.offerReference, variantReference: item.variantReference, quantity: line.quantity })); void act("substitution-preference", { orderLineId: line.id, preference, ...(preference === "PREAPPROVED_CHOICES_ONLY" ? { choices } : {}) }); }}>
      <label htmlFor={`preference-${line.id}`} className="block text-sm font-bold">If {line.title} is unavailable</label>
      <select id={`preference-${line.id}`} name="preference" defaultValue={line.preference} disabled={saving} className="min-h-11 w-full rounded-lg border p-2"><option value="REFUND_IF_UNAVAILABLE">Refund unavailable items</option><option value="NO_SUBSTITUTION">Do not substitute</option><option value="CONTACT_ME">Ask me before a replacement</option><option value="PREAPPROVED_CHOICES_ONLY">Only my selected replacements</option></select>
      <details><summary className="min-h-11 cursor-pointer py-3">Choose permitted replacement items</summary><p className="text-sm">Choose up to three items when using selected replacements. Approval covers up to {line.quantity} units at the current price; the server checks the paid amount. You still confirm the final proposal.</p><fieldset disabled={saving} className="max-h-64 overflow-y-auto"><legend className="sr-only">Permitted replacements for {line.title}</legend>{data.replacements.map(item => <label key={item.offerReference} className="flex min-h-11 items-center gap-3"><input type="checkbox" name="replacementChoice" value={item.offerReference} defaultChecked={line.selectedChoiceReferences.includes(item.offerReference)} />{item.label}</label>)}</fieldset></details>
      <Button type="submit" variant="secondary" disabled={saving}>Save item preference</Button>
    </form>)}
    {data.proposals.map(proposal => <article key={proposal.reference} className="rounded-lg border p-4 space-y-3" aria-label={`Replacement ${proposal.reference}`}>
      <h4 className="font-bold">Proposed replacement: {proposal.title}</h4><p>{proposal.variantTitle} · quantity {proposal.quantity}</p><p>Replacement price R {proposal.amount}; original paid amount R {proposal.originalAmount}.</p><p>Decision expires {new Date(proposal.expiresAt).toLocaleString("en-ZA")}. A lower price requires a separate refund; this decision does not confirm receipt of money.</p>
      <div className="flex flex-wrap gap-3"><Button disabled={saving} onClick={() => void act("decide-substitution", { proposalReference: proposal.reference, decision: "APPROVE" })}>Approve replacement</Button><Button variant="secondary" disabled={saving} onClick={() => void act("decide-substitution", { proposalReference: proposal.reference, decision: "REJECT_AND_REFUND" })}>Reject and request refund</Button></div>
    </article>)}
    {data.canCancel ? <details><summary className="min-h-11 cursor-pointer py-3 font-bold">Request cancellation of this store order</summary><form className="space-y-3" onSubmit={event => { event.preventDefault(); void act("request-cancellation", { reasonCode: "CUSTOMER_CHANGED_MIND" }); }}><p>The server checks fulfilment and records any required refund separately.</p><label className="flex min-h-11 items-center gap-3"><input type="checkbox" required /> I want to cancel this store order.</label><Button type="submit" variant="secondary" disabled={saving}>Confirm cancellation request</Button></form></details> : null}
    <p role={failed ? "alert" : "status"} aria-live="polite">{message}</p>
  </section>;
}
