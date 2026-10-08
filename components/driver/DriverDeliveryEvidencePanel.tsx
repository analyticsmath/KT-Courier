"use client";
import { useRef, useState, type FormEvent } from "react";

export function DriverDeliveryEvidencePanel({ assignmentId, assignmentVersion, onProof }: { assignmentId: string; assignmentVersion: number; onProof: (reference: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reports = useRef(new Map<string, string>());
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFailed(false); setMessage(null);
    try {
      const data = new FormData(event.currentTarget); data.set("assignmentVersion", String(assignmentVersion));
      const response = await fetch(`/api/driver/assignments/${assignmentId}/delivery/proof`, { method: "POST", body: data });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Proof could not be uploaded.");
      onProof(result.evidenceReference); setMessage("Private proof uploaded and verified by the server.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Proof upload is unavailable."); } finally { setBusy(false); }
  }
  async function report(type: "SAFETY_CHECK" | "LAWFUL_TRANSPORT_CONFIRMATION") {
    setBusy(true); setFailed(false); setMessage(null);
    const key = `${type}:${assignmentVersion}`; const operationId = reports.current.get(key) ?? `DRROP-${crypto.randomUUID().toUpperCase()}`; reports.current.set(key, operationId);
    try {
      const response = await fetch(`/api/driver/assignments/${assignmentId}/delivery/responsibilities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId, assignmentVersion, reportType: type }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Confirmation could not be recorded.");
      setMessage(type === "SAFETY_CHECK" ? "Safety check recorded." : "Lawful transport confirmation recorded.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Confirmation is unavailable."); } finally { setBusy(false); }
  }
  return <section aria-labelledby="delivery-evidence-title" className="space-y-3 rounded-xl border border-[var(--kt-soft-border)] p-4">
    <h3 id="delivery-evidence-title" className="font-semibold">Delivery evidence and responsibilities</h3>
    <p className="text-sm">Confirm checks you performed. Upload private proof from this delivery; the server checks its assignment before use.</p>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3" onClick={() => void report("SAFETY_CHECK")}>Confirm safety check</button><button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3" onClick={() => void report("LAWFUL_TRANSPORT_CONFIRMATION")}>Confirm lawful transport</button></div>
    <form onSubmit={upload} className="space-y-3"><label className="block" htmlFor="delivery-proof-file">Private delivery proof image</label><input id="delivery-proof-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required disabled={busy} /><button type="submit" disabled={busy} className="min-h-11 rounded-lg border px-3">Upload private delivery proof</button></form>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </section>;
}
