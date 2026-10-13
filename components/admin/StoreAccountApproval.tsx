"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StoreAccountApproval({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function approve() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const reply = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(reply.error ?? "Vendor account approval could not be recorded.");
        return;
      }
      setMessage("Vendor account approved. Seller identity and catalog review remain separate.");
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
    <div className="space-y-2">
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      {message ? <p role="status" aria-live="polite" className="text-sm">{message}</p> : null}
      <Button type="button" disabled={busy} onClick={() => void approve()}>
        {busy ? "Approving…" : "Approve vendor account"}
      </Button>
    </div>
  );
}
