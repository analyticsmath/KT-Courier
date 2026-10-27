"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FileInput } from "@/components/ui/FileInput";
import { Input } from "@/components/ui/Input";
import { utcDateInputToIso } from "@/lib/utils/utc-date-input";

export function StoreSellerIdentityForm({ currentReference }: { currentReference: string | null }) {
  const router = useRouter(), pending = useRef(false), command = useRef<{ signature: string; body: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadEvidence() {
    if (!documentFile || uploading) return;
    setUploading(true); setError(""); setStatus("");
    try {
      const data = new FormData(); data.set("file", documentFile);
      const response = await fetch("/api/store/seller-identity/documents", { method: "POST", body: data });
      const reply = await response.json();
      if (!response.ok || !reply.document?.publicReference) { setError(reply.error ?? "Document upload could not be confirmed."); return; }
      setEvidenceReference(reply.document.publicReference);
      setStatus("Private document uploaded. Submit the seller details below to send it for review.");
    } catch { setError("Document upload could not be confirmed. Please retry."); }
    finally { setUploading(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError(""); setStatus("");
    const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) ?? "").trim(), optional = (key: string) => value(key) || null;
    try {
      const fields = { expectedIdentityReference: currentReference, identityVersion: value("identityVersion"), legalName: value("legalName"), tradingName: optional("tradingName"), registrationReference: optional("registrationReference"), vatRegistrationStatus: value("vatRegistrationStatus"), vatNumber: optional("vatNumber"), countryCode: "ZA", termsReference: optional("termsReference"), invoiceClassification: value("invoiceClassification"), effectiveFrom: utcDateInputToIso(value("effectiveFrom")), effectiveUntil: value("effectiveUntil") ? utcDateInputToIso(value("effectiveUntil")) : null, sourceEvidenceReference: value("sourceEvidenceReference"), confirmSuppliedDetails: data.get("confirmSuppliedDetails") === "on" };
      const signature = JSON.stringify(fields);
      if (command.current?.signature !== signature) command.current = { signature, body: { ...fields, operationId: crypto.randomUUID() } };
      const response = await fetch("/api/store/seller-identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command.current.body) });
      const reply = await response.json(); if (!response.ok) { setError(reply.error ?? "Seller details could not be submitted."); return; }
      setStatus("Seller identity submitted for independent review."); router.refresh();
    } catch { setError("Submission could not be confirmed. Retry the same details to check this request."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} aria-label="Seller legal identity submission" className="space-y-4">
    <p>Supply the seller details and supporting evidence for a separate administrator to review. Checkout requires an effective reviewed identity and approved commercial policies.</p>
    <p className="rounded-lg border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] p-3 text-sm">An unregistered business or individual seller can submit details for review without a company registration number. Use the legal name of the owner when selling as an individual, and put the shop name (for example, Pammy Bakes) under Trading name. Registration and VAT references are optional when not registered. Required business permits or licences still apply where relevant.</p>
    <fieldset className="space-y-3 rounded-lg border p-4" disabled={busy || uploading}>
      <legend className="font-bold">Supporting document</legend>
      <label htmlFor="seller-evidence-file">Verification file</label>
      <FileInput id="seller-evidence-file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setDocumentFile(event.target.files?.[0] ?? null)} />
      <p className="text-sm">PDF, JPEG, PNG or WebP, up to 10 MB. Files stay private and can be downloaded by authorized reviewers.</p>
      <Button type="button" disabled={!documentFile || uploading} onClick={uploadEvidence}>{uploading ? "Uploading document…" : "Upload supporting document"}</Button>
      {/^PMO-[a-f0-9-]{36}$/.test(evidenceReference) ? <a className="block underline" href={`/api/private-media/${encodeURIComponent(evidenceReference)}`}>Download uploaded document</a> : null}
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>Identity version (reference, not the seller name)<Input name="identityVersion" required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" title="Use letters, numbers, underscores, periods or hyphens, without spaces. Example: PAMMY_BAKES_V1" placeholder="PAMMY_BAKES_V1" helpText="Example: PAMMY_BAKES_V1 — no spaces. Use a new version when submitting revised evidence." /></label>
      <label>Legal seller name<Input name="legalName" required maxLength={240} helpText="For an individual seller, enter the legal name of the owner, not just the shop name." /></label>
      <label>Trading name (optional)<Input name="tradingName" maxLength={160} placeholder="Pammy Bakes" /></label>
      <label>Registration reference (optional)<Input name="registrationReference" maxLength={160} helpText="Leave blank if not formally registered. Do not invent a registration number." /></label>
      <div><label htmlFor="seller-vat-status">VAT registration status</label><select id="seller-vat-status" name="vatRegistrationStatus" required defaultValue="" className="min-h-11 w-full rounded border p-2"><option value="" disabled>Select supplied status</option><option value="NOT_REGISTERED">Not registered</option><option value="REGISTERED">Registered</option></select></div>
      <label>VAT reference<Input name="vatNumber" maxLength={160} /></label>
      <div><label htmlFor="seller-receipt-classification">Receipt classification</label><select id="seller-receipt-classification" name="invoiceClassification" required defaultValue="" className="min-h-11 w-full rounded border p-2"><option value="" disabled>Select reviewed classification</option><option value="RECEIPT">Receipt</option><option value="TAX_INVOICE">Tax invoice</option></select></div>
      <label>Terms reference<Input name="termsReference" maxLength={160} /></label>
      <p className="sm:col-span-2">Enter effective times in UTC. The review window uses these exact UTC times regardless of your device time zone.</p>
      <label>Effective from (UTC)<Input name="effectiveFrom" type="datetime-local" required /></label>
      <label>Effective until (UTC, optional)<Input name="effectiveUntil" type="datetime-local" /></label>
      <label className="sm:col-span-2">Supplied evidence reference<Input name="sourceEvidenceReference" value={evidenceReference} onChange={event => setEvidenceReference(event.target.value)} required minLength={8} maxLength={240} helpText="Use the reference automatically generated after uploading a genuine supporting document. This is not simply your shop name; an independent administrator must review the evidence." /></label>
    </div>
    <label className="flex items-start gap-2"><input name="confirmSuppliedDetails" type="checkbox" required />I confirm these are the supplied seller details and evidence for review.</label>
    {error ? <p role="alert">{error}</p> : null}<p role="status" aria-live="polite">{status}</p>
    <Button type="submit" disabled={busy || uploading}>{busy ? "Submitting seller details…" : "Submit seller identity"}</Button>
  </form>;
}
