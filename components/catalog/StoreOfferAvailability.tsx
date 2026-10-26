"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StoreOfferAvailability({ reference, version, status }: { reference: string; version: number; status: string }) {
  const router = useRouter();
  const operation = useRef(crypto.randomUUID()), pending = useRef(false);
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const action = status === "PAUSED" ? "resume" : "pause";
  if (!["ACTIVE", "OUT_OF_STOCK", "PAUSED"].includes(status)) return null;
  async function change() {
    if (pending.current || confirmed) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/store/catalog/offers/${encodeURIComponent(reference)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, operationId: operation.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The listing could not be updated.");
      if (result.offer?.publicReference !== reference || result.offer.status !== (action === "pause" ? "PAUSED" : "ACTIVE")) throw new Error("The listing update could not be confirmed. Reload to check its current state.");
      setConfirmed(true); setMessage(action === "pause" ? "Listing paused. New purchases are blocked; existing orders still need fulfilment." : "Listing resumed. Marketplace availability still depends on publication, stock and store approval."); router.refresh();
    } catch (failure) { setError(failure instanceof TypeError ? "The update could not be confirmed. Retry to check the same request." : failure instanceof Error ? failure.message : "The listing could not be updated."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="space-y-3"><p className="text-sm">{action === "pause" ? "Temporarily stop new purchases for this listing. Existing orders remain your responsibility." : "Resume a listing you previously paused. This does not approve or publish a product."}</p><Button type="button" disabled={busy || confirmed} onClick={() => void change()}>{busy ? "Updating listing…" : action === "pause" ? "Pause listing" : "Resume listing"}</Button><p role="status">{message}</p><p role="alert" className="text-sm text-red-600">{error}</p></div>;
}
