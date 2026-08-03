"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { VALID_STATUS_TRANSITIONS } from "@/lib/validation/order";
import { getOrderStatusConfig } from "@/lib/constants/statuses";
import type { OrderStatus } from "@/types/db";

interface AdminOrderStatusUpdateProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function AdminOrderStatusUpdate({ orderId, currentStatus }: AdminOrderStatusUpdateProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validTransitions = (VALID_STATUS_TRANSITIONS[currentStatus] ?? []) as OrderStatus[];

  if (validTransitions.length === 0) {
    return (
      <p className="text-sm text-[var(--kt-text-muted)]">
        No further transitions from <strong>{getOrderStatusConfig(currentStatus).label}</strong>. This status is terminal.
      </p>
    );
  }

  async function handleUpdate() {
    if (!selectedStatus) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          note: note.trim() || undefined,
          internalNote: internalNote.trim() || undefined,
        }),
      });

      const data = await res.json() as { error?: string };

      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess(true);
      setSelectedStatus("");
      setNote("");
      setInternalNote("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wide mb-3">
          Transition from{" "}
          <span className="text-[var(--kt-ink-navy)] normal-case font-bold">
            {getOrderStatusConfig(currentStatus).label}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {validTransitions.map((status) => {
            const config = getOrderStatusConfig(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status === selectedStatus ? "" : status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  selectedStatus === status
                    ? "border-[var(--kt-signal-cobalt)] bg-[var(--kt-cloud-blue)] text-[var(--kt-signal-cobalt)]"
                    : "border-[var(--kt-soft-border)] text-[var(--kt-text-muted)] hover:border-[var(--kt-signal-cobalt)] hover:text-[var(--kt-signal-cobalt)]"
                }`}
              >
                → {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedStatus && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="status_note">Public note <span className="text-[var(--kt-text-muted)] font-normal normal-case">(visible to customer/store)</span></Label>
            <Textarea
              id="status_note"
              placeholder="Add a note visible to the customer or store…"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="status_internal_note">Internal note <span className="text-[var(--kt-text-muted)] font-normal normal-case">(admin only — never shared)</span></Label>
            <Textarea
              id="status_internal_note"
              placeholder="Add an internal operational note…"
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[var(--kt-mint-wash)] border border-[var(--kt-teal-emerald)]/20 rounded-xl px-4 py-3">
          <p className="text-sm text-[var(--kt-teal-emerald)]">Status updated successfully.</p>
        </div>
      )}

      {selectedStatus && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Updating…" : `Confirm: Set to ${getOrderStatusConfig(selectedStatus).label}`}
        </Button>
      )}
    </div>
  );
}
