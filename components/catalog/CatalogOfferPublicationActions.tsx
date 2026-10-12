"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CatalogOfferPublicationActions({ offerId, version, productVersion, reviewed, canApprove, canPublish, price }: {
  offerId: string; version: number; productVersion: number; reviewed: boolean; canApprove: boolean; canPublish: boolean;
  price: { publicReference: string; amount: string } | null;
}) {
  const router = useRouter(); const inFlight = useRef(false);
  const operation = useRef<{ identity: string; id: string } | null>(null);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function act(action: "approve" | "publish") {
    if (inFlight.current) return;
    if (!/^[A-Z0-9_]{3,80}$/.test(reason)) { setError("Enter a review reason using letters, numbers and underscores."); return; }
    const facts = action === "publish" ? { version, productVersion, priceVersionReference: price?.publicReference, reasonCode: reason } : { version, reasonCode: reason };
    const identity = JSON.stringify({ action, ...facts });
    if (operation.current?.identity !== identity) operation.current = { identity, id: crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/catalog/offers/${offerId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...facts, operationId: operation.current.id }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "The offer action could not be completed.");
      setMessage(action === "publish" ? result.offer?.status === "ACTIVE" && result.offer?.publicationStatus === "PUBLISHED" ? "The reviewed listing is published." : "Publication receipt found. Review the current offer state." : "Offer review recorded. Publication is a separate action."); router.refresh();
    } catch (failure) { setError(failure instanceof TypeError ? "The result could not be confirmed. Retry unchanged fields to check its receipt." : failure instanceof Error ? failure.message : "The offer action could not be completed."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="space-y-3">
    {price && <p className="text-sm">Reviewed price: R {price.amount}</p>}
    <label htmlFor={`offer-review-${offerId}`} className="block text-sm font-medium">Offer publication reason<Input id={`offer-review-${offerId}`} value={reason} maxLength={80} disabled={busy} onChange={event => setReason(event.target.value.toUpperCase())} /></label>
    {!reviewed && canApprove && <Button type="button" disabled={busy} onClick={() => void act("approve")}>Approve offer</Button>}
    {reviewed && canPublish && price && <Button type="button" disabled={busy} onClick={() => void act("publish")}>Publish reviewed listing</Button>}
    <p role="status">{message}</p><p role="alert" className="text-sm text-red-600">{error}</p>
  </div>;
}
