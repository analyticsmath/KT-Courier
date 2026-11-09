"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function DriverEngagementEditor({ driverId, initial }: {
  driverId: string;
  initial: {
    engagementType: "FREELANCE" | "SALARIED" | null;
    engagementContractReference: string | null;
    engagementEffectiveFrom: string | null;
    engagementRevision: number;
  };
}) {
  const router = useRouter();
  const [type, setType] = useState(initial.engagementType ?? "");
  const [reference, setReference] = useState(initial.engagementContractReference ?? "");
  const [date, setDate] = useState(initial.engagementEffectiveFrom ?? "");
  const [revision, setRevision] = useState(initial.engagementRevision);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/drivers/" + encodeURIComponent(driverId) + "/engagement", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementType: type,
          contractReference: reference,
          effectiveFrom: date,
          reason,
          expectedRevision: revision,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error ?? "Driver engagement could not be saved.");
      setRevision(body.revision);
      setMessage("Engagement classification and contract reference saved with an audit entry. No salary or earnings calculation was changed.");
      setReason("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record driver agreement.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
    <p className="text-sm text-[var(--kt-text-soft)]">
      Classify the approved employment arrangement and reference a real signed agreement.
      This record does not activate a salary, commission rate, withdrawal, or payroll rule.
    </p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor={"driver-engagement-"+driverId}>Driver engagement type</Label>
        <select id={"driver-engagement-"+driverId} className="mt-1 w-full rounded-lg border border-[var(--kt-border)] bg-white p-3"
          required value={type} onChange={event => setType(event.target.value)}>
          <option value="">Choose after contract review</option>
          <option value="FREELANCE">Freelance</option><option value="SALARIED">Salaried</option>
        </select>
      </div>
      <div><Label htmlFor={"driver-contract-"+driverId}>Signed agreement reference</Label>
        <Input id={"driver-contract-"+driverId} required minLength={12} maxLength={120}
          value={reference} onChange={event => setReference(event.target.value)} />
      </div>
      <div><Label htmlFor={"driver-engagement-date-"+driverId}>Effective date (South Africa)</Label>
        <Input id={"driver-engagement-date-"+driverId} required type="date" value={date}
          onChange={event => setDate(event.target.value)} />
      </div>
      <div><Label htmlFor={"driver-engagement-note-"+driverId}>Reason / reviewed agreement evidence</Label>
        <textarea id={"driver-engagement-note-"+driverId} required minLength={25} maxLength={750}
          value={reason} onChange={event => setReason(event.target.value)}
          className="mt-1 min-h-24 w-full rounded-lg border border-[var(--kt-border)] bg-white p-3 text-sm" />
      </div>
    </div>
    <Button type="submit" disabled={busy} loading={busy}>Record engagement classification</Button>
    {error && <p role="alert" className="text-sm text-[var(--kt-red)]">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
