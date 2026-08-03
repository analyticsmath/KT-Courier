"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import type { DriverEligibilityDto } from "@/lib/dto/assignment.dto";

interface Props {
  orderId: string;
  eligibleDrivers: DriverEligibilityDto[];
  currentDriverId?: string;
  currentAssignmentId?: string;
  currentAssignmentVersion?: number;
  isReassign?: boolean;
  onSuccess?: () => void;
}

export function AssignOrderForm({
  orderId,
  eligibleDrivers,
  currentDriverId,
  currentAssignmentId,
  currentAssignmentVersion,
  isReassign = false,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [driverProfileId, setDriverProfileId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDrivers = eligibleDrivers.filter((d) => d.id !== currentDriverId);

  const label = isReassign ? "Reassign" : "Assign Driver";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverProfileId) {
      setError("Please select a driver.");
      return;
    }
    if (isReassign && !reason.trim()) {
      setError("A reason is required for reassignment.");
      return;
    }

    setLoading(true);
    setError(null);

    const endpoint = isReassign
      ? `/api/admin/orders/${orderId}/reassign`
      : `/api/admin/orders/${orderId}/assign`;

    const body = isReassign
      ? { currentAssignmentId, expectedVersion: currentAssignmentVersion, newDriverProfileId: driverProfileId, reasonCode: "OPERATIONAL_CHANGE", note: reason }
      : { driverProfileId, reasonCode: "INITIAL_ASSIGNMENT", adminNote: adminNote || undefined };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Assignment failed. Please try again.");
        return;
      }
      setOpen(false);
      setDriverProfileId("");
      setAdminNote("");
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
      <Button
        variant={isReassign ? "secondary" : "primary"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--kt-soft-border)] flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--kt-ink-navy)]">{label}</h3>
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
            <Label htmlFor="driver-select">Select Driver</Label>
            <select
              id="driver-select"
              value={driverProfileId}
              onChange={(e) => setDriverProfileId(e.target.value)}
              required
              className="w-full h-11 px-3 rounded-xl border border-[var(--kt-border)] bg-white text-sm text-[var(--kt-text)] focus:border-[var(--kt-signal-cobalt)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-signal-cobalt)]/20"
            >
              <option value="">— Select a driver —</option>
              {availableDrivers.length === 0 && (
                <option disabled>No eligible drivers available</option>
              )}
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName || d.driverCode} ({d.driverCode}) — {d.eligibility.replace(/_/g, " ")}
                  {d.availability !== "AVAILABLE" ? ` [${d.availability}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {isReassign && (
            <div>
              <Label htmlFor="reassign-reason">Reason for Reassignment *</Label>
              <Textarea
                id="reassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this order being reassigned?"
                rows={2}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="admin-note">Admin Note (optional)</Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Internal note for this assignment..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Saving…" : label}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
