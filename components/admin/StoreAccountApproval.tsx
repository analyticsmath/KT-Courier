"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StoreAccountApproval({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("Owner identity email verified and business contact confirmed.");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function approve() {
    if (pending.current || !reviewed) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      });
      const reply = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(reply.error ?? "Business account approval could not be recorded.");
        return;
      }
      setMessage("Business account approved. Public shop listing stays closed until seller identity, pickup readiness, catalog approval, and checkout capability certification pass.");
      router.refresh();
    } catch {
      setError("Approval could not be confirmed. Refresh the store list before retrying.");
      router.refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p role="status" aria-live="polite" className="text-sm font-medium">{message}</p> : null}
      <label className="block text-sm">
        <span className="block text-xs font-medium">Approval audit note (optional)</span>
        <input
          type="text"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" />
        <span>I have reviewed this vendor’s registration, email-verified owner account, and business contact details. Approving the business account unlocks vendor workspace onboarding while public shop listing, seller identity, pickup route readiness, catalog moderation, and checkout capability certification remain separate gates.</span>
      </label>
      <Button type="button" disabled={busy || !reviewed} onClick={() => void approve()}>
        {busy ? "Approving…" : "Approve business account"}
      </Button>
    </div>
  );
}
