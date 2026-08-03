"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ContactMessageStatus } from "@/types/db";

const ALLOWED_TRANSITIONS: Record<ContactMessageStatus, ContactMessageStatus[]> = {
  [ContactMessageStatus.NEW]: [ContactMessageStatus.READ, ContactMessageStatus.ARCHIVED],
  [ContactMessageStatus.READ]: [ContactMessageStatus.RESPONDED, ContactMessageStatus.ARCHIVED],
  [ContactMessageStatus.RESPONDED]: [ContactMessageStatus.ARCHIVED],
  [ContactMessageStatus.ARCHIVED]: [],
};

const STATUS_LABELS: Record<ContactMessageStatus, string> = {
  [ContactMessageStatus.NEW]: "New",
  [ContactMessageStatus.READ]: "Read",
  [ContactMessageStatus.RESPONDED]: "Responded",
  [ContactMessageStatus.ARCHIVED]: "Archived",
};

interface ContactMessageStatusUpdateProps {
  messageId: string;
  currentStatus: ContactMessageStatus;
}

export function ContactMessageStatusUpdate({
  messageId,
  currentStatus,
}: ContactMessageStatusUpdateProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ContactMessageStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validTransitions = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  if (validTransitions.length === 0) {
    return (
      <p className="text-sm text-[--kt-text-muted]">
        No further transitions available from{" "}
        <strong>{STATUS_LABELS[currentStatus]}</strong>.
      </p>
    );
  }

  async function handleUpdate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/contact-messages/${messageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected }),
      });

      const data = (await res.json()) as { error?: string };

      if (data.error) {
        setError(data.error);
        return;
      }

      setSuccess(true);
      setSelected("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide">
        Update status from{" "}
        <span className="text-[--kt-text] normal-case font-bold">
          {STATUS_LABELS[currentStatus]}
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        {validTransitions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setSelected(status === selected ? "" : status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              selected === status
                ? "border-[--kt-brand-blue] bg-[--kt-blue-soft] text-[--kt-brand-blue]"
                : "border-[--kt-border] text-[--kt-text-soft] hover:border-[--kt-brand-blue]"
            }`}
          >
            → {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-[--kt-green-soft] border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700">Status updated successfully.</p>
        </div>
      )}

      {selected && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Updating…" : `Confirm: Mark as ${STATUS_LABELS[selected]}`}
        </Button>
      )}
    </div>
  );
}
