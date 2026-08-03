"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";

interface Props {
  orderId: string;
  assignmentId: string;
  expectedVersion: number;
  onSuccess?: () => void;
}

export function CancelAssignmentForm({ orderId, assignmentId, expectedVersion, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required to cancel an assignment.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, expectedVersion, reasonCode: "OPERATIONAL_CHANGE", note: reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cancellation failed. Please try again.");
        return;
      }
      setOpen(false);
      setReason("");
      if (onSuccess) onSuccess();
      else window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Cancel Assignment
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--kt-soft-border)] flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--kt-ink-navy)]">Cancel Assignment</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--kt-text-muted)] hover:text-[var(--kt-ink-navy)] text-xl leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[var(--kt-signal-red)]/10 border border-[var(--kt-signal-red)]/30 text-sm text-[var(--kt-signal-red)]">
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="cancel-reason">Reason for Cancellation *</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this assignment being cancelled?"
              rows={3}
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="secondary" fullWidth disabled={loading}>
              {loading ? "Cancelling…" : "Confirm Cancel"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Back
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
