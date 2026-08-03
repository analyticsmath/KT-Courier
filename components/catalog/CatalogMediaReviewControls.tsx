"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CatalogMediaReviewControls({ assetId, status }: { assetId: string; status: string }) {
  const router = useRouter();
  const [reasonCode, setReasonCode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function act(action: "approve" | "quarantine" | "reject") {
    if (!reasonCode.trim()) { setMessage("Enter a reviewed reason code."); return; }
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/catalog/media/${encodeURIComponent(assetId)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), reasonCode: reasonCode.trim().toLocaleUpperCase("en-ZA").replace(/[^A-Z0-9]+/g, "_") }) });
      const body = await response.json() as { error?: string };
      setMessage(response.ok ? `Media ${action} evidence recorded.` : body.error ?? "Media review failed.");
      if (response.ok) router.refresh();
    } finally { setPending(false); }
  }
  return <section className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-5" aria-labelledby="media-review-heading"><h2 id="media-review-heading" className="text-lg font-black">Media review</h2><p className="mt-1 text-sm text-[var(--kt-text-muted)]">Current lifecycle state: {status.replaceAll("_", " ")}. Actions record immutable evidence and never change ownership.</p><label htmlFor="catalog-media-review-reason" className="mt-4 block text-sm font-bold">Reason code</label><Input id="catalog-media-review-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} placeholder="REVIEWED_MEDIA_EVIDENCE" /><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={pending || status !== "QUARANTINED"} onClick={() => void act("approve")}>Approve READY</Button><Button type="button" variant="secondary" disabled={pending || !["UPLOADED", "VALIDATING", "READY"].includes(status)} onClick={() => void act("quarantine")}>Quarantine</Button><Button type="button" variant="danger" disabled={pending || status === "ARCHIVED"} onClick={() => void act("reject")}>Reject</Button></div><p className="mt-3 text-sm" role="status" aria-live="polite">{message}</p></section>;
}
