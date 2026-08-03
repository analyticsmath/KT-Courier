"use client";

import { useState } from "react";

export function CancelRefundButton({ publicReference }: Readonly<{ publicReference: string }>) {
  const [message, setMessage] = useState<string | null>(null); const [pending, setPending] = useState(false);
  async function cancel() {
    setPending(true); setMessage(null);
    try { const response = await fetch(`/api/refunds/${publicReference}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID() }) }); const payload = await response.json() as { error?: string }; setMessage(response.ok ? "Refund cancellation recorded and the exact reservation was released." : payload.error ?? "Refund could not be cancelled."); }
    catch { setMessage("Refund could not be cancelled."); }
    finally { setPending(false); }
  }
  return <div><button type="button" disabled={pending} onClick={cancel} className="rounded border px-3 py-2">{pending ? "Cancelling…" : "Cancel refund"}</button>{message ? <p role="status" className="mt-2 text-sm">{message}</p> : null}</div>;
}

