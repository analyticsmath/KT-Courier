"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PreparationResult = Readonly<{ prepared: number; preserved: number; status: "DRAFT"; independentReviewRequired: true }>;

export function OwnerCommissionDefaultPreparation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function prepare() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/commission-plans/owner-selected-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await response.json() as Partial<PreparationResult> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Commission defaults could not be prepared.");
      setMessage(`Prepared ${data.prepared ?? 0} draft(s); preserved ${data.preserved ?? 0} existing scope(s). Independent review is required before activation.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commission defaults could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-3 rounded border border-[--kt-border] p-4" aria-label="owner-approved-commission-defaults">
    <h2 className="font-semibold">Prepare owner-approved default drafts</h2>
    <p className="text-sm text-[--kt-text-muted]">Prepares the 30% courier and 8% store commission defaults only for active scopes with no existing plan. Existing operator terms are preserved. These remain editable drafts; finance review and activation are still required. This creates no charge or settlement.</p>
    <button type="button" onClick={() => void prepare()} disabled={busy} className="min-h-12 rounded border px-4">
      {busy ? "Preparing drafts…" : "Prepare missing commission drafts"}
    </button>
    {message ? <p role="status" aria-live="polite">{message}</p> : null}
  </section>;
}
