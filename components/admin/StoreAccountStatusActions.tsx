"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreStatus } from "@/types/db";

type ActionableStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export function StoreAccountStatusActions({ storeId, status }: { storeId: string; status: StoreStatus }) {
  const router = useRouter();
  const pending = useRef(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (status === "PENDING") return null;
  const actions: { status: ActionableStatus; label: string }[] = status === "ACTIVE"
    ? [{ status: "SUSPENDED", label: "Suspend store" }, { status: "DISABLED", label: "Disable store" }]
    : [{ status: "ACTIVE", label: "Reactivate store" }];
  async function change(next: ActionableStatus) {
    if (pending.current || (next !== "ACTIVE" && reason.trim().length < 12)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason: reason.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Store status change failed.");
      setNotice(`Store status changed to ${next.toLowerCase()}.`);
      setReason("");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change store status.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <details className="min-w-40 text-sm">
    <summary className="cursor-pointer rounded-md border px-3 py-2 font-medium">Manage store</summary>
    <div className="mt-2 space-y-2">
      <label className="block"><span className="block text-xs">Status change reason</span>
        <textarea aria-label="Store status reason" className="mt-1 min-h-20 w-full rounded-md border p-2" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Non-payment, policy breach, or reason for reinstatement" />
      </label>
      <p className="text-xs">Provide at least 12 characters to suspend or disable a store. All changes are audited.</p>
      {actions.map(action => <button key={action.status} type="button" className="mr-2 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={busy || (action.status !== "ACTIVE" && reason.trim().length < 12)} onClick={() => void change(action.status)}>{busy ? "Saving…" : action.label}</button>)}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  </details>;
}
