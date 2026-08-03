"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CatalogModerationControls({ productId, version }: { productId: string; version: number }) {
  const router = useRouter(); const [reasonCode, setReasonCode] = useState("CATALOG_REVIEWED"); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  async function act(action: "approve" | "request-changes" | "reject" | "suspend") {
    setBusy(true); setStatus("Recording moderation evidence…");
    const response = await fetch(`/api/admin/catalog/products/${productId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, operationId: crypto.randomUUID(), reasonCode }) });
    const body = await response.json() as { error?: string };
    setBusy(false); setStatus(response.ok ? "Moderation evidence recorded." : body.error ?? "Moderation action failed."); if (response.ok) router.refresh();
  }
  return <div className="space-y-4"><div><label htmlFor="moderation-reason" className="mb-1 block text-sm font-extrabold">Reason code</label><Input id="moderation-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value.toLocaleUpperCase("en-ZA").replace(/[^A-Z0-9_]/g, ""))} /></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => act("approve")}>Approve</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => act("request-changes")}>Request changes</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => act("reject")}>Reject</Button><Button type="button" variant="danger" disabled={busy} onClick={() => act("suspend")}>Suspend</Button></div><p className="text-sm" aria-live="polite">{status}</p><p className="text-xs text-[var(--kt-text-muted)]">Approval records reviewed evidence only. Public activation remains blocked and hard validation cannot be overridden.</p></div>;
}

