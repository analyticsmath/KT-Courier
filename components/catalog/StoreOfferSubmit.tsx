"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StoreOfferSubmit({ reference, version }: { reference: string; version: number }) {
  const router = useRouter(); const pending = useRef(false); const operation = useRef("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [status, setStatus] = useState("");
  async function submit() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    if (!operation.current) operation.current = crypto.randomUUID();
    try {
      const response = await fetch(`/api/store/catalog/offers/${reference}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, operationId: operation.current }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Offer submission could not be completed.");
      setStatus("Offer submitted for independent review."); router.refresh();
    } catch (failure) { setError(failure instanceof TypeError ? "The submission could not be confirmed. Retry to check its receipt." : failure instanceof Error ? failure.message : "Offer submission could not be completed."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="space-y-3"><Button type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Submitting offer…" : "Submit offer for review"}</Button><p role="status">{status}</p><p role="alert" className="text-sm text-red-600">{error}</p></div>;
}
