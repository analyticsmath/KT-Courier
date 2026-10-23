"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

export function DriverDeliveryEvidencePanel({ assignmentId, assignmentVersion, onProof }: { assignmentId: string; assignmentVersion: number; onProof: (reference: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reports = useRef(new Map<string, string>());
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    const form = event.currentTarget;
    setBusy(true); setUploading(true); setFailed(false); setMessage(null);
    try {
      const data = new FormData(form); data.set("assignmentVersion", String(assignmentVersion));
      const response = await fetch(`/api/driver/assignments/${assignmentId}/delivery/proof`, { method: "POST", body: data });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Proof could not be uploaded.");
      onProof(result.evidenceReference); setMessage(`Private proof uploaded: ${selectedFile.name}. Ready for delivery confirmation.`);
      form.reset(); setSelectedFile(null);
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Proof upload is unavailable."); } finally { setBusy(false); setUploading(false); }
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
    <div className="flex flex-wrap gap-3"><Button variant="secondary" type="button" disabled={busy} onClick={() => void report("SAFETY_CHECK")}>Confirm safety check</Button><Button variant="secondary" type="button" disabled={busy} onClick={() => void report("LAWFUL_TRANSPORT_CONFIRMATION")}>Confirm lawful transport</Button></div>
    <form onSubmit={upload} className="space-y-3 border-t border-[var(--kt-soft-border)] pt-4" aria-busy={uploading}>
      <label className="block font-medium" htmlFor="delivery-proof-file">Private delivery proof image</label>
      <p id="delivery-proof-help" className="text-sm text-[var(--kt-text-muted)]">Choose a clear photo of this delivery. JPEG, PNG or WebP, up to 10 MB. Your photo stays private.</p>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>{selectedFile ? "Choose a different photo" : "Choose delivery photo"}</Button>
      <input ref={fileInput} id="delivery-proof-file" name="file" type="file" className="sr-only" tabIndex={-1} accept="image/jpeg,image/png,image/webp" aria-describedby="delivery-proof-help delivery-proof-selection" disabled={busy} onChange={(event) => {
        const file = event.currentTarget.files?.[0] ?? null;
        setMessage(null); setFailed(false);
        if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024)) {
          setSelectedFile(null); event.currentTarget.value = ""; setFailed(true); setMessage("Choose a JPEG, PNG or WebP photo between 1 byte and 10 MB."); return;
        }
        setSelectedFile(file);
      }} />
      <p id="delivery-proof-selection" className="break-all text-sm" aria-live="polite">{selectedFile ? `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to upload` : "No photo selected."}</p>
      <Button type="submit" disabled={busy || !selectedFile} loading={uploading}>{uploading ? "Uploading private proof…" : "Upload private delivery proof"}</Button>
    </form>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </section>;
}
