"use client";

import { useState } from "react";

export function CommissionReversalForm({ accrualId }: { accrualId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(formData: FormData) {
    const response = await fetch(`/api/admin/commissions/${accrualId}/reverse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), reasonCode: formData.get("reasonCode") }) });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? "Canonical reversal request completed. Refresh to inspect immutable evidence." : data.error ?? "Commission reversal failed.");
  }
  return <form action={submit} className="space-y-2" aria-label="commission-reversal"><h2 className="font-semibold">Canonical reversal</h2><label htmlFor="commission-reversal-reason">Approved reason code<input id="commission-reversal-reason" name="reasonCode" pattern="[A-Z][A-Z0-9_]{2,79}" required /></label><button type="submit">Reverse commission</button>{message ? <p role="status">{message}</p> : null}</form>;
}
